import traceback
import logging
from redis import Redis
from rq import Queue
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, Body
from fastapi.responses import JSONResponse
from elasticsearch import Elasticsearch
import json
import os
from datetime import datetime, timezone
from typing import Optional
from machine_learning.forest import fetch_data_from_es, load_tfidf_models, recommend_recipe, load_weights_from_json, \
    train_tfidf_model, train_weight

# ================================================================
# App & 연결 초기화
# ================================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

es_host = os.getenv("ELASTICSEARCH_HOST", "elasticsearch")
es = Elasticsearch([f"http://{es_host}:9200"])

redis_url = os.getenv('REDIS_URL', 'redis://redis:6379')
redis = Redis.from_url(redis_url, socket_timeout=180)
queue = Queue(connection=redis, job_timeout="30m")

# ================================================================
# Utility Functions
# ================================================================

def load_mapping(file_path):
    with open(file_path, "r") as f:
        return json.load(f)


def get_index_and_mapping(file_type: str):
    index_mapping = {
        "cocktail":       ("recipe_cocktail",  "cocktail_mapping.json"),
        "food":           ("recipe_food",       "food_mapping.json"),
        "feed":           ("feed",              "feed_mapping.json"),
        "forum_post":     ("forum_post",        "forum_post_mapping.json"),
        "forum_category": ("forum_category",    "forum_category_mapping.json"),
    }
    return index_mapping.get(file_type, (None, None))


def create_index_if_not_exists(index_name: str, mapping_file: str = None):
    if not es.indices.exists(index=index_name):
        if mapping_file and os.path.exists(mapping_file):
            try:
                mapping = load_mapping(mapping_file)
                es.indices.create(index=index_name, body=mapping)
                logger.info(f"인덱스 '{index_name}' 매핑 파일 '{mapping_file}'로 생성")
            except Exception as e:
                logger.error(f"매핑 파일로 인덱스 생성 실패: {e}. 빈 매핑으로 생성")
                es.indices.create(index=index_name, body={})
        else:
            es.indices.create(index=index_name, body={})
            logger.info(f"인덱스 '{index_name}' 빈 매핑으로 생성")


# ES에 저장하지 않을 필드 (DB에서 관리)
ES_EXCLUDED_FIELDS = {"like", "dislike", "author", "updateId"}


def strip_db_fields(data: dict) -> dict:
    return {k: v for k, v in data.items() if k not in ES_EXCLUDED_FIELDS}


# ================================================================
# 레시피 업로드 / 수정
# ================================================================

@app.post("/upload/index")
def upload_index(body: dict = Body(...)):
    index_name = body.get("index_name")
    mapping_file = body.get("mapping_file")
    if not index_name:
        raise HTTPException(status_code=400, detail="index_name is required")
    if not es.indices.exists(index=index_name):
        create_index_if_not_exists(index_name, mapping_file)
        return {"message": f"Index {index_name} created successfully"}
    else:
        raise HTTPException(status_code=400, detail=f"Index {index_name} already exists")


@app.post("/upload/one")
def upload_one(data: dict = Body(...)):
    try:
        file_type = data.get("type")
        if not file_type:
            raise HTTPException(status_code=400, detail="Type is required")

        index_name, mapping_file = get_index_and_mapping(file_type)
        if not index_name:
            raise HTTPException(status_code=400, detail="Invalid type")

        if not es.indices.exists(index=index_name):
            create_index_if_not_exists(index_name, mapping_file)

        es_data = strip_db_fields(data)
        res = es.index(index=index_name, body=es_data)
        return {"message": "Data uploaded successfully", "id": res["_id"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/update/reaction-counts")
@app.post("/update/likes-reports")
def update_reaction_counts(data: dict = Body(...)):
    try:
        reaction_count_data = data.get("reaction_count_data", [])
        if not reaction_count_data:
            legacy = data.get("like_report_data", [])
            if legacy:
                grouped = {}
                for entry in legacy:
                    post_id = entry.get("postId")
                    content_type = entry.get("type")
                    if not post_id or not content_type:
                        continue
                    key = (post_id, content_type)
                    grouped.setdefault(key, {"postId": post_id, "type": content_type, "likeCount": 0, "dislikeCount": 0})
                    key_type = entry.get("keyType")
                    value = entry.get("value", 0)
                    if key_type == "like":
                        grouped[key]["likeCount"] = value
                    elif key_type in ("report", "dislike"):
                        grouped[key]["dislikeCount"] = value
                reaction_count_data = list(grouped.values())

        if not reaction_count_data:
            raise HTTPException(status_code=400, detail="No reaction count data provided")

        for entry in reaction_count_data:
            post_id = entry.get("postId")
            content_type = entry.get("type")
            like_count = entry.get("likeCount")
            dislike_count = entry.get("dislikeCount")

            if not post_id or not content_type or like_count is None or dislike_count is None:
                logger.warning(f"Skipping entry due to missing fields: {entry}")
                continue

            index_name, _ = get_index_and_mapping(content_type)
            if not index_name:
                logger.error(f"Invalid content type: {content_type}")
                continue

            try:
                doc = es.get(index=index_name, id=post_id, ignore=404)
                if doc.get("found", False):
                    es.update(index=index_name, id=post_id, body={"doc": {"like": like_count, "dislike": dislike_count}})
                else:
                    logger.error(f"Document {post_id} not found in {index_name}")
            except Exception as e:
                logger.error(f"ES update error for {post_id} in {index_name}:\n{traceback.format_exc()}")

        return {"message": "Reaction counts updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unhandled error in /update/reaction-counts:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload/json")
async def upload_json(file: UploadFile = File(...), type: str = Form(...)):
    try:
        index_name, mapping_file = get_index_and_mapping(type)
        if not index_name:
            raise HTTPException(status_code=400, detail="Invalid type")

        if not es.indices.exists(index=index_name):
            create_index_if_not_exists(index_name, mapping_file)

        content = await file.read()
        data = json.loads(content)
        for item in data:
            es.index(index=index_name, body=strip_db_fields(item))

        return {"message": "Data uploaded successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/update/one")
def update_one(data: dict = Body(...)):
    try:
        file_type = data.get("type")
        if not file_type:
            raise HTTPException(status_code=400, detail="Type is required")

        doc_id = data.get("updateId")
        if not doc_id:
            raise HTTPException(status_code=400, detail="ID is required")

        index_name, mapping_file = get_index_and_mapping(file_type)
        if not es.indices.exists(index=index_name):
            create_index_if_not_exists(index_name, mapping_file)

        es.update(index=index_name, id=doc_id, body={"doc": data})
        return {"message": "Data updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# 검색
# ================================================================

@app.get("/search")
def search(
    q: str = Query(default=""),
    type: str = Query(default=""),
    category: str = Query(default=""),
    cookingMethod: str = Query(default=""),
    page: int = Query(default=1),
    size: int = Query(default=20),
):
    try:
        index_name, _ = get_index_and_mapping(type)
        if not index_name:
            raise HTTPException(status_code=400, detail="Invalid type filter")

        if type == "food":
            category_field = "RCP_PAT2"
            cooking_field = "RCP_WAY2"
            multi_match_fields = ["name", "ingredients.ingredient", "RCP_PAT2"]
        elif type == "forum_post":
            category_field = "category"
            cooking_field = "cookingMethod"
            multi_match_fields = ["title", "content", "authorName", "category"]
        else:
            category_field = "category"
            cooking_field = "cookingMethod"
            multi_match_fields = ["name", "ingredients.ingredient", "category"]

        if q and category and cookingMethod:
            query = {"bool": {"must": [
                {"multi_match": {"query": q, "fields": multi_match_fields}},
                {"term": {category_field: {"value": category}}},
                {"term": {cooking_field: {"value": cookingMethod}}}
            ]}}
        elif q and category:
            query = {"bool": {"must": [
                {"multi_match": {"query": q, "fields": multi_match_fields}},
                {"term": {category_field: {"value": category}}}
            ]}}
        elif q and cookingMethod:
            query = {"bool": {"must": [
                {"multi_match": {"query": q, "fields": multi_match_fields}},
                {"term": {cooking_field: {"value": cookingMethod}}}
            ]}}
        elif category and cookingMethod:
            query = {"bool": {"must": [
                {"term": {category_field: {"value": category}}},
                {"term": {cooking_field: {"value": cookingMethod}}}
            ]}}
        elif q:
            query = {"multi_match": {"query": q, "fields": multi_match_fields}}
        elif category:
            query = {"term": {category_field: {"value": category}}}
        elif cookingMethod:
            query = {"term": {cooking_field: {"value": cookingMethod}}}
        else:
            query = {"match_all": {}}

        if type == "food":
            source_fields = ["name", "RCP_PAT2", "RCP_WAY2", "ATT_FILE_NO_MAIN"]
        elif type == "forum_post":
            source_fields = ["title", "content", "authorName", "contentJSON",
                             "viewsCount", "likesCount", "createdAt", "updatedAt",
                             "category", "comments", "sticky"]
        else:
            source_fields = ["name", "category", "abv", "image"]

        body = {"from": (page - 1) * size, "size": size, "_source": source_fields, "query": query}
        res = es.search(index=index_name, body=body)
        hits = res["hits"]["hits"]
        results = []
        for hit in hits:
            doc = hit["_source"]
            doc["id"] = hit["_id"]
            results.append(doc)

        if type == "forum_post":
            for doc in results:
                comments = doc.get("comments", [])
                if comments:
                    doc["latestComment"] = sorted(comments, key=lambda c: c.get("createdAt", ""), reverse=True)[0]
                else:
                    doc["latestComment"] = None

        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search/autocomplete")
def autocomplete(
    q: str = Query(default=""),
    type: str = Query(default=""),
    size: int = Query(default=10),
):
    try:
        q = q.strip()
        type = type.strip()
        if not q or not type:
            return []

        index_name, _ = get_index_and_mapping(type)
        if not index_name:
            raise HTTPException(status_code=400, detail="Invalid type")

        body = {
            "size": size * 2,
            "_source": ["name"],
            "query": {
                "bool": {
                    "should": [
                        {"match_phrase_prefix": {"name": {"query": q, "max_expansions": 20, "boost": 3}}},
                        {"nested": {
                            "path": "ingredients",
                            "query": {"match_phrase_prefix": {
                                "ingredients.ingredient": {"query": q, "max_expansions": 20}
                            }},
                            "boost": 1
                        }}
                    ],
                    "minimum_should_match": 1
                }
            }
        }

        res = es.search(index=index_name, body=body)
        hits = res.get("hits", {}).get("hits", [])
        seen = set()
        result = []
        for hit in hits:
            name = hit.get("_source", {}).get("name")
            if name and name not in seen:
                seen.add(name)
                result.append(name)
                if len(result) >= size:
                    break
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[autocomplete] 오류: {str(e)}")
        return []


@app.get("/search/alcohol")
def search_alcohol(
    min_abv: int = Query(default=0),
    max_abv: int = Query(default=100),
    page: int = Query(default=1),
    size: int = Query(default=20),
):
    try:
        res = es.search(index="recipe_cocktail", body={
            "from": (page - 1) * size,
            "size": size,
            "_source": ["name", "category", "like"],
            "query": {"range": {"abv": {"gte": min_abv, "lte": max_abv}}}
        })
        return [{**hit["_source"], "id": hit["_id"]} for hit in res["hits"]["hits"]]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/detail/{doc_id}")
def detail(doc_id: str, type: str = Query(default="")):
    index_name, _ = get_index_and_mapping(type)
    if not index_name:
        raise HTTPException(status_code=400, detail="Invalid type filter")
    try:
        response = es.get(index=index_name, id=doc_id)
        return response["_source"]
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# ================================================================
# Forum 게시글
# ================================================================

@app.post("/forum/post")
def create_forum_post(data: dict = Body(...)):
    try:
        if "categoryId" in data and "category" not in data:
            data["category"] = data["categoryId"]

        index_name, mapping_file = get_index_and_mapping("forum_post")
        if not es.indices.exists(index=index_name):
            create_index_if_not_exists(index_name, mapping_file)

        now = datetime.now(timezone.utc).isoformat()
        data.setdefault("viewsCount", 0)
        data.setdefault("likesCount", 0)
        data.setdefault("likedBy", [])
        data.setdefault("reportCount", 0)
        data.setdefault("comments", [])
        data.setdefault("sticky", False)
        data.setdefault("createdAt", now)
        data.setdefault("updatedAt", now)

        res = es.index(index=index_name, body=data)
        es.indices.refresh(index=index_name)
        return {"message": "게시글이 생성되었습니다.", "id": res["_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/forum/post/{doc_id}")
def get_forum_post(doc_id: str):
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        res = es.get(index=index_name, id=doc_id)
        data = res["_source"]
        data["id"] = res["_id"]

        comments = data.get("comments", [])
        if comments:
            data["latestComment"] = sorted(comments, key=lambda c: c.get("createdAt", ""), reverse=True)[0]
        else:
            data["latestComment"] = None
        return data
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.put("/forum/post/{doc_id}/title")
def update_forum_post_title(doc_id: str, body: dict = Body(...)):
    try:
        new_title = body.get("title")
        if not new_title:
            raise HTTPException(status_code=400, detail="새 제목이 필요합니다.")

        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=doc_id)["_source"]
        post["title"] = new_title
        post["updatedAt"] = datetime.now(timezone.utc).isoformat()

        if body.get("isAdmin", False):
            post["editedTitleByAdmin"] = True
            post["editedByTitle"] = "ADMIN"
        else:
            post["editedTitleByAdmin"] = False
            post["editedByTitle"] = body.get("editedBy", "USER")

        es.index(index=index_name, id=doc_id, body=post)
        return {"message": "제목이 수정되었습니다.", "title": new_title}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/forum/post/{doc_id}/content")
def update_forum_post_content(doc_id: str, body: dict = Body(...)):
    try:
        contentJSON = body.get("contentJSON")
        if not contentJSON:
            raise HTTPException(status_code=400, detail="contentJSON 필드는 필수입니다.")

        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=doc_id)["_source"]
        post["contentJSON"] = contentJSON
        post["updatedAt"] = datetime.now(timezone.utc).isoformat()

        if body.get("isAdmin", False):
            post["editedContentByAdmin"] = True
            post["editedByContent"] = "ADMIN"
            post["locked"] = True
        else:
            post["editedContentByAdmin"] = False
            post["editedByContent"] = body.get("editedBy", "USER")

        es.index(index=index_name, id=doc_id, body=post)
        es.indices.refresh(index=index_name)
        return {"message": "내용이 수정되었습니다.", "contentJSON": contentJSON}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forum/post/{doc_id}/like")
def toggle_forum_post_like(doc_id: str, body: dict = Body(...)):
    try:
        member_id = body.get("memberId")
        if not member_id:
            raise HTTPException(status_code=400, detail="memberId가 필요합니다.")

        index_name, _ = get_index_and_mapping("forum_post")
        post_data = es.get(index=index_name, id=doc_id)["_source"]
        liked_by = post_data.get("likedBy", [])

        if member_id in liked_by:
            liked_by.remove(member_id)
            post_data["likesCount"] = max(post_data.get("likesCount", 0) - 1, 0)
            liked = False
        else:
            liked_by.append(member_id)
            post_data["likesCount"] = post_data.get("likesCount", 0) + 1
            liked = True

        post_data["likedBy"] = liked_by
        post_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=doc_id, body=post_data)
        return {"liked": liked, "likesCount": post_data["likesCount"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forum/post/{doc_id}/report")
def report_forum_post(doc_id: str, body: dict = Body(...)):
    try:
        reporter_id = body.get("reporterId")
        reason = body.get("reason")
        if not reporter_id or not reason:
            raise HTTPException(status_code=400, detail="신고자 ID와 신고 사유는 필수입니다.")

        REPORT_THRESHOLD = 10
        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=doc_id)["_source"]

        if post.get("memberId") == reporter_id:
            raise HTTPException(status_code=400, detail="자신의 게시글은 신고할 수 없습니다.")

        post["reportCount"] = post.get("reportCount", 0) + 1
        if post["reportCount"] >= REPORT_THRESHOLD:
            post["hidden"] = True
        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=doc_id, body=post)
        return {"message": "게시글이 신고되었습니다.", "reportCount": post["reportCount"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/forum/post/{doc_id}")
def delete_forum_post(doc_id: str, removedBy: str = Query(default="USER")):
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=doc_id)["_source"]

        if "originalTitle" not in post:
            post["originalTitle"] = post.get("title", "")
        if "originalContent" not in post:
            post["originalContent"] = post.get("content", "")

        history = {
            "postId": post.get("id", doc_id),
            "title": post.get("title"),
            "content": post.get("content"),
            "authorName": post.get("member", {}).get("nickName", "Unknown"),
            "deletedAt": datetime.now(timezone.utc).isoformat(),
            "fileUrls": post.get("fileUrls", [])
        }
        es.index(index="forum_post_history", body=history)

        post["removedBy"] = removedBy
        post["hidden"] = True
        post["title"] = "[Deleted]"
        post["content"] = "This post has been deleted."
        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=doc_id, body=post)
        return {"message": "게시글이 삭제 처리되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/forum/post/{doc_id}/hard-delete")
def hard_delete_forum_post(doc_id: str):
    """게시글 하드 삭제 - Elasticsearch에서 완전히 제거 (관리자 전용)"""
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        es.delete(index=index_name, id=doc_id)
        return {"message": "게시글이 완전히 삭제되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forum/post/{doc_id}/hide")
def hide_forum_post(doc_id: str):
    """게시글 숨김 처리 (관리자 전용)"""
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=doc_id)["_source"]
        post["hidden"] = True
        post["removedBy"] = "ADMIN"
        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=doc_id, body=post)
        return {"message": "게시글이 숨김 처리되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forum/post/{doc_id}/restore")
def restore_forum_post(doc_id: str):
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=doc_id)["_source"]

        if "originalTitle" in post:
            post["title"] = post["originalTitle"]
        if "originalContent" in post:
            post["content"] = post["originalContent"]

        post["hidden"] = False
        post["removedBy"] = None
        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=doc_id, body=post)
        return {"message": "게시글이 복구되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forum/post/{doc_id}/increment-view")
def increment_view_count(doc_id: str):
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        res = es.get(index=index_name, id=doc_id)
        data = res["_source"]
        data["viewsCount"] = data.get("viewsCount", 0) + 1
        data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=doc_id, body=data)
        return {"message": "조회수가 증가되었습니다.", "viewsCount": data["viewsCount"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# Forum 댓글
# ================================================================

@app.post("/forum/comment")
def create_forum_comment(data: dict = Body(...)):
    try:
        for field in ["postId", "memberId", "content"]:
            if field not in data:
                raise HTTPException(status_code=400, detail=f"{field} 필드는 필수입니다.")

        index_name, _ = get_index_and_mapping("forum_post")
        post_id = str(data["postId"])
        post = es.get(index=index_name, id=post_id)["_source"]

        nick_name = data.get("authorName", data.get("nickName", "Unknown"))
        comments = post.get("comments", [])

        new_comment = {
            "id": len(comments) + 1,
            "content": data["content"],
            "contentJSON": data.get("contentJSON", ""),
            "member": {"memberId": data["memberId"], "nickName": nick_name},
            "authorName": nick_name,
            "memberId": data["memberId"],
            "likesCount": 0,
            "hidden": False,
            "removedBy": None,
            "fileUrl": data.get("fileUrl", ""),
            "reportCount": 0,
            "parentCommentId": data.get("parentCommentId"),
            "opAuthorName": data.get("opAuthorName", ""),
            "opContent": data.get("opContent", ""),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "editedBy": None,
            "locked": False
        }

        comments.append(new_comment)
        post["comments"] = comments
        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=post_id, body=post)
        es.indices.refresh(index=index_name)
        return {"message": "댓글이 추가되었습니다.", "comment": new_comment}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/forum/comments")
def get_forum_comments(postId: str = Query(...)):
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=str(postId))["_source"]
        return post.get("comments", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/forum/comment/{comment_id}")
def update_forum_comment(comment_id: int, body: dict = Body(...)):
    try:
        new_contentJSON = body.get("contentJSON")
        if not new_contentJSON:
            raise HTTPException(status_code=400, detail="contentJSON 필드는 필수입니다.")

        post_id = body.get("postId")
        if not post_id:
            raise HTTPException(status_code=400, detail="postId 필드가 필요합니다.")

        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=str(post_id))["_source"]
        comments = post.get("comments", [])
        updated = False

        for comment in comments:
            if comment.get("id") == comment_id:
                comment["contentJSON"] = new_contentJSON
                comment["updatedAt"] = datetime.now(timezone.utc).isoformat()
                comment["editedBy"] = body.get("editedBy", "USER")
                if body.get("isAdmin", False):
                    comment["locked"] = True
                updated = True
                break

        if not updated:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")

        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=str(post_id), body=post)
        return {"message": "댓글이 수정되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/forum/comment/{comment_id}")
def delete_forum_comment(comment_id: int, postId: str = Query(...), removedBy: str = Query(default="USER")):
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=str(postId))["_source"]
        comments = post.get("comments", [])
        deleted = False

        for comment in comments:
            if comment.get("id") == comment_id:
                es.index(index="forum_comment_history", body={
                    "commentId": comment_id,
                    "content": comment.get("content"),
                    "authorName": comment.get("member", {}).get("nickName", "Unknown"),
                    "deletedAt": datetime.now(timezone.utc).isoformat()
                })
                comment["content"] = "[Removed]"
                comment["hidden"] = True
                comment["removedBy"] = removedBy
                comment["updatedAt"] = datetime.now(timezone.utc).isoformat()
                deleted = True
                break

        if not deleted:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")

        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=str(postId), body=post)
        return {"message": "댓글이 삭제되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/forum/comment/{comment_id}/hard-delete")
def hard_delete_forum_comment(comment_id: int):
    """댓글 하드 삭제 - 게시글에서 댓글을 완전히 제거 (관리자 전용)"""
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        # postId 없이 전달되므로 comments.id 로 게시글 검색
        res = es.search(index=index_name, body={
            "query": {"nested": {"path": "comments", "query": {"term": {"comments.id": comment_id}}}},
            "size": 1
        })
        if res["hits"]["total"]["value"] == 0:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")

        hit = res["hits"]["hits"][0]
        post_id = hit["_id"]
        post = hit["_source"]
        post["comments"] = [c for c in post.get("comments", []) if c.get("id") != comment_id]
        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=post_id, body=post)
        return {"message": "댓글이 완전히 삭제되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forum/comment/{comment_id}/hide")
def hide_forum_comment(comment_id: int):
    """댓글 숨김 처리 (관리자 전용) - postId 없이 검색"""
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        res = es.search(index=index_name, body={
            "query": {"nested": {"path": "comments", "query": {"term": {"comments.id": comment_id}}}},
            "size": 1
        })
        if res["hits"]["total"]["value"] == 0:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")

        hit = res["hits"]["hits"][0]
        post_id = hit["_id"]
        post = hit["_source"]
        hidden = False
        for comment in post.get("comments", []):
            if comment.get("id") == comment_id:
                comment["hidden"] = True
                comment["removedBy"] = "ADMIN"
                comment["updatedAt"] = datetime.now(timezone.utc).isoformat()
                hidden = True
                break

        if not hidden:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")

        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=post_id, body=post)
        return {"message": "댓글이 숨김 처리되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forum/comment/{comment_id}/restore")
def restore_forum_comment(comment_id: int, postId: str = Query(...)):
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=str(postId))["_source"]
        comments = post.get("comments", [])

        history_res = es.search(index="forum_comment_history", body={
            "query": {"term": {"commentId": comment_id}},
            "sort": [{"deletedAt": {"order": "desc"}}],
            "size": 1
        })
        original_content = None
        if history_res["hits"]["total"]["value"] > 0:
            original_content = history_res["hits"]["hits"][0]["_source"]["content"]

        restored = False
        for comment in comments:
            if comment.get("id") == comment_id:
                comment["content"] = original_content if original_content else "원본 내용 복원 불가"
                comment["hidden"] = False
                comment["removedBy"] = None
                comment["updatedAt"] = datetime.now(timezone.utc).isoformat()
                restored = True
                break

        if not restored:
            raise HTTPException(status_code=404, detail="복원할 댓글을 찾을 수 없습니다.")

        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=str(postId), body=post)
        return {"message": "댓글이 복원되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forum/comment/{comment_id}/like")
def toggle_forum_comment_like(comment_id: int, body: dict = Body(...)):
    try:
        member_id = body.get("memberId")
        if not member_id:
            raise HTTPException(status_code=400, detail="memberId가 필요합니다.")

        post_id = body.get("postId")
        index_name, _ = get_index_and_mapping("forum_post")
        post_data = es.get(index=index_name, id=post_id)["_source"]
        comments = post_data.get("comments", [])
        liked = False
        c = None

        for c in comments:
            if c["id"] == comment_id:
                liked_by = c.get("likedBy", [])
                if member_id in liked_by:
                    liked_by.remove(member_id)
                    c["likesCount"] = max(c.get("likesCount", 0) - 1, 0)
                    liked = False
                else:
                    liked_by.append(member_id)
                    c["likesCount"] = c.get("likesCount", 0) + 1
                    liked = True
                c["likedBy"] = liked_by
                c["updatedAt"] = datetime.now(timezone.utc).isoformat()
                break

        post_data["comments"] = comments
        post_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=post_id, body=post_data)
        return {"liked": liked, "totalLikes": c["likesCount"] if c else 0}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forum/comment/{comment_id}/report")
def report_forum_comment(comment_id: int, body: dict = Body(...)):
    try:
        reporter_id = body.get("reporterId")
        reason = body.get("reason")
        if not reporter_id or not reason:
            raise HTTPException(status_code=400, detail="신고자 ID와 신고 사유가 필요합니다.")

        post_id = body.get("postId")
        if not post_id:
            raise HTTPException(status_code=400, detail="postId 필드가 필요합니다.")

        REPORT_THRESHOLD = 10
        index_name, _ = get_index_and_mapping("forum_post")
        post = es.get(index=index_name, id=str(post_id))["_source"]
        comments = post.get("comments", [])
        updated = False

        for comment in comments:
            if comment.get("id") == comment_id:
                if comment.get("member", {}).get("memberId") == reporter_id:
                    raise HTTPException(status_code=400, detail="자신의 댓글은 신고할 수 없습니다.")
                comment["reportCount"] = comment.get("reportCount", 0) + 1
                if comment["reportCount"] >= REPORT_THRESHOLD:
                    comment["hidden"] = True
                comment["updatedAt"] = datetime.now(timezone.utc).isoformat()
                updated = True
                break

        if not updated:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")

        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=str(post_id), body=post)
        return {"message": "댓글이 신고되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forum/comment/{comment_id}/increment-like")
def increment_comment_likes(comment_id: int):
    """댓글 좋아요 수 단순 증가 (memberId 토글 없이 카운트만 올림)"""
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        # postId 없이 전달되므로 nested 검색으로 게시글 찾기
        res = es.search(index=index_name, body={
            "query": {"nested": {"path": "comments", "query": {"term": {"comments.id": comment_id}}}},
            "size": 1
        })
        if res["hits"]["total"]["value"] == 0:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")

        hit = res["hits"]["hits"][0]
        post_id = hit["_id"]
        post = hit["_source"]
        updated = False
        likes_count = 0

        for comment in post.get("comments", []):
            if comment.get("id") == comment_id:
                comment["likesCount"] = comment.get("likesCount", 0) + 1
                comment["updatedAt"] = datetime.now(timezone.utc).isoformat()
                likes_count = comment["likesCount"]
                updated = True
                break

        if not updated:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")

        post["updatedAt"] = datetime.now(timezone.utc).isoformat()
        es.index(index=index_name, id=post_id, body=post)
        return {"message": "댓글 좋아요가 증가되었습니다.", "likesCount": likes_count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# Forum 카테고리
# ================================================================

@app.get("/forum/category")
def get_forum_categories():
    try:
        index_name, _ = get_index_and_mapping("forum_category")
        res = es.search(index=index_name, body={"query": {"match_all": {}}})
        return [{**hit["_source"], "id": hit["_id"]} for hit in res["hits"]["hits"]]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/forum/category/search")
def search_forum_category(title: str = Query(...)):
    try:
        index_name, _ = get_index_and_mapping("forum_category")
        res = es.search(index=index_name, body={"query": {"match_phrase": {"title": title}}})
        hits = res.get("hits", {}).get("hits", [])
        if hits:
            doc = hits[0]
            source = doc["_source"]
            source["id"] = doc["_id"]
            return source
        raise HTTPException(status_code=404, detail="Not Found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/forum/category/{category_id}")
def get_forum_category_by_id(category_id: str):
    try:
        index_name, _ = get_index_and_mapping("forum_category")
        res = es.get(index=index_name, id=category_id)
        category = res["_source"]
        category["id"] = res["_id"]
        return category
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/forum/category")
def create_forum_category(data: dict = Body(...)):
    try:
        index_name, mapping_file = get_index_and_mapping("forum_category")
        if not es.indices.exists(index=index_name):
            create_index_if_not_exists(index_name, mapping_file)

        res = es.index(index=index_name, body=data)
        es.indices.refresh(index=index_name)
        return {"message": "카테고리가 생성되었습니다.", "id": res["_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# Forum 회원별 조회
# ================================================================

@app.get("/forum/searchByMember")
def search_posts_by_member(
    memberId: str = Query(...),
    page: int = Query(default=1),
    size: int = Query(default=10),
):
    try:
        index_name, _ = get_index_and_mapping("forum_post")
        from_offset = (page - 1) * size
        res = es.search(index=index_name, body={
            "query": {"term": {"memberId": memberId}},
            "from": from_offset,
            "size": size
        })
        posts = []
        for hit in res["hits"]["hits"]:
            doc = hit["_source"]
            doc["id"] = hit["_id"]
            posts.append(doc)
        return posts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/forum/comments/searchByMember")
def search_comments_by_member(
    memberId: int = Query(...),
    page: int = Query(default=1),
    size: int = Query(default=10),
):
    try:
        from_offset = (page - 1) * size
        index_name, _ = get_index_and_mapping("forum_post")
        res = es.search(index=index_name, body={
            "query": {
                "nested": {
                    "path": "comments",
                    "query": {"match": {"comments.memberId": memberId}},
                    "inner_hits": {"from": from_offset, "size": size}
                }
            },
            "size": 0
        })
        comments = []
        for hit in res["hits"]["hits"]:
            inner = hit.get("inner_hits", {}).get("comments", {})
            for comment_hit in inner.get("hits", {}).get("hits", []):
                comments.append(comment_hit["_source"])
        return comments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# ML 모델
# ================================================================

@app.post("/model/train")
def train_machine_learning(type: str = Query(default="")):
    try:
        if not type:
            raise HTTPException(status_code=400, detail="type이 비어있습니다.")

        index_name, _ = get_index_and_mapping(type)
        df = fetch_data_from_es(index_name)
        train_tfidf_model(df, type)

        name_vec, ing_vec, major_vec, minor_vec, abv_sca = load_tfidf_models(type)
        weight_configs = load_weights_from_json(type)

        if not weight_configs:
            name_weight, ing_weight, major_weight, minor_weight, abv_weight = 0.1, 0.5, 0.4, 0.2, 0.1
        else:
            name_weight  = weight_configs.get("weight_name", 0.1)
            ing_weight   = weight_configs.get("weight_ingredients", 0.5)
            major_weight = weight_configs.get("weight_major", 0.4)
            minor_weight = weight_configs.get("weight_minor", 0.2)
            abv_weight   = weight_configs.get("weight_abv", None)

        task = queue.enqueue(
            train_weight, type, df, name_vec, ing_vec, major_vec, minor_vec, abv_sca,
            name_weight, ing_weight, major_weight, minor_weight, abv_weight, 10, 0.005
        )
        return JSONResponse(status_code=202, content={"message": "모델 학습이 시작되었습니다.", "task_id": task.get_id()})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type} 모델 생성중 에러: {str(e)}")


@app.get("/task/status/{task_id}")
def task_status(task_id: str):
    job = queue.fetch_job(task_id)
    if job is None:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    job.refresh()
    if job.is_queued:
        return {"status": "대기중"}
    elif job.is_started:
        return {"status": "진행 중"}
    elif job.is_finished:
        return {"status": "완료"}
    elif job.is_failed:
        error_message = job.meta.get("exception", "알 수 없는 오류")
        return {"status": "실패", "message": error_message}
    return {"status": "알 수 없음"}


@app.post("/model/predict")
def predict_machine_learning(type: str = Query(default=""), data: dict = Body(...)):
    try:
        if not type:
            raise HTTPException(status_code=400, detail="type이 비어있습니다.")

        index_name, _ = get_index_and_mapping(type)
        df = fetch_data_from_es(index_name)
        train_tfidf_model(df, type)

        name_vec, ing_vec, major_vec, minor_vec, abv_sca = load_tfidf_models(type)
        weight_configs = load_weights_from_json(type)

        if not weight_configs:
            name_weight, ing_weight, major_weight, minor_weight, abv_weight = 0.1, 0.5, 0.4, 0.2, 0.1
        else:
            name_weight  = weight_configs.get("weight_name", 0.1)
            ing_weight   = weight_configs.get("weight_ingredients", 0.5)
            major_weight = weight_configs.get("weight_major", 0.4)
            minor_weight = weight_configs.get("weight_minor", 0.2)
            abv_weight   = weight_configs.get("weight_abv", None)

        recommendation = recommend_recipe(
            data, df, name_vec, ing_vec, major_vec, minor_vec, abv_sca,
            3, name_weight, ing_weight, major_weight, minor_weight, abv_weight
        )
        return recommendation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type} 모델 사용중 에러: {str(e)}")


# ================================================================
# 프로필 / 관리자
# ================================================================

@app.get("/api/profile/recipes")
def get_user_recipes(
    memberId: str = Query(...),
    page: int = Query(default=0),
    size: int = Query(default=10),
):
    try:
        try:
            member_id_int = int(memberId)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid memberId")

        from_offset = page * size
        index_names = ["recipe_cocktail", "recipe_food"]
        query = {
            "query": {"term": {"author": member_id_int}},
            "from": from_offset,
            "size": size,
            "_source": ["name"]
        }

        try:
            response = es.search(index=index_names, body=query)
        except Exception as e:
            if "index_not_found_exception" in str(e):
                return []
            raise

        hits = response.get("hits", {}).get("hits", [])
        if not hits:
            return []

        results = []
        for hit in hits:
            doc = hit["_source"]
            doc["title"] = doc.pop("name", "")
            doc["content_type"] = "cocktail" if hit["_index"] == "recipe_cocktail" else "food"
            doc["id"] = hit["_id"]
            results.append(doc)
        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/reset-recipe-indexes")
def reset_recipe_indexes():
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        results = {}
        configs = [
            ("recipe_food",     "food_mapping.json",    "food.json"),
            ("recipe_cocktail", "cocktail_mapping.json", "cocktail.json"),
        ]

        for index_name, mapping_file, data_file in configs:
            if es.indices.exists(index=index_name):
                es.indices.delete(index=index_name)
                logger.info(f"[reset] 인덱스 '{index_name}' 삭제 완료")

            mapping_path = os.path.join(base_dir, mapping_file)
            if os.path.exists(mapping_path):
                es.indices.create(index=index_name, body=load_mapping(mapping_path))
            else:
                es.indices.create(index=index_name, body={})
            logger.info(f"[reset] 인덱스 '{index_name}' 생성 완료")

            data_path = os.path.join(base_dir, data_file)
            if not os.path.exists(data_path):
                results[index_name] = {"error": f"{data_file} 파일 없음"}
                logger.error(f"[reset] 데이터 파일 없음: {data_path}")
                continue

            with open(data_path, "r", encoding="utf-8") as f:
                items = json.load(f)

            count = 0
            for item in items:
                es.index(index=index_name, body=strip_db_fields(item))
                count += 1

            results[index_name] = {"indexed": count}
            logger.info(f"[reset] '{index_name}': {count}개 문서 색인 완료")

        return {"message": "인덱스 재설정 및 재색인 완료", "results": results}
    except Exception as e:
        logger.error(f"[reset] 인덱스 재설정 오류:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
