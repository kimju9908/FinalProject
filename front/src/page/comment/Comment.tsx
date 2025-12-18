import React, { useState, useEffect } from "react";
import {
  Box,
  List,
  Divider,
  TextField,
  Button,
  Typography,
  Pagination,
} from "@mui/material";
import { AxiosError } from "axios";
import RecipeApi from "../../api/RecipeApi"; // RecipeApi를 임포트
import { CommentDto, CommentSectionProps } from "../../api/dto/RecipeDto";
import { useSelector } from "react-redux";
import { RootState } from "../../context/Store";

const Comment: React.FC<CommentSectionProps> = ({ postId }) => {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentContent, setCommentContent] = useState<string>("");
  const [replyContent, setReplyContent] = useState<string>("");
  const [expandedCommentIds, setExpandedCommentIds] = useState<number[]>([]);
  const [page, setPage] = useState<number>(1); // 현재 페이지
  const [totalPages, setTotalPages] = useState<number>(1); // 전체 페이지 수
  const memberId = useSelector((state: RootState) => state.user.id); // Redux에서 memberId 가져오기

  // 댓글을 가져오는 함수
  const fetchComments = async () => {
    try {
      const response = await RecipeApi.fetchComments(postId, page);
      setComments(response.content ?? []);
      setTotalPages(response.totalPages); // 전체 페이지 수 설정
    } catch (err) {
      console.error("댓글을 불러오는 데 실패했습니다.", err);
      setComments([]);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const response = await RecipeApi.deleteComment(commentId);
      if (response) {
        // 댓글 삭제 후 댓글 목록 새로고침
        fetchComments();
      }
    } catch (err) {
      console.error("댓글 삭제에 실패했습니다.", err);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId, page]);

  const handleCommentSubmit = async () => {
    if (commentContent.trim() === "") return;

    try {
      const response = await RecipeApi.addComment(postId, commentContent);
      if (response) {
        // 댓글 작성 후 댓글 목록 새로 고침
        fetchComments();
        setCommentContent("");
      }
    } catch (err) {
      console.error("댓글 작성에 실패했습니다.", err);

      // AxiosError로 타입 가드
      if (
        err instanceof AxiosError &&
        err.response &&
        err.response.status === 500
      ) {
        alert("댓글 작성은 로그인 후 사용 가능합니다.");
      }
    }
  };

  const handleReplySubmit = async (
    parentCommentId: number,
    replyContent: string
  ) => {
    if (replyContent.trim() === "") return;

    try {
      const response = await RecipeApi.addReply(parentCommentId, replyContent);
      if (response) {
        setReplyContent(""); // 입력 필드 초기화
        fetchComments(); // 댓글 목록 새로고침
      }
    } catch (err) {
      console.error("대댓글 작성에 실패했습니다.", err);
    }
  };

  const toggleReplies = (commentId: number) => {
    setExpandedCommentIds((prev) =>
      prev.includes(commentId)
        ? prev.filter((id) => id !== commentId)
        : [...prev, commentId]
    );
  };

  return (
    <Box sx={{ marginTop: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: "bold" }}>
        댓글
      </Typography>
      <List>
        {comments.map((comment) => (
          <CommentItem
            key={comment.commentId}
            comment={comment}
            onReplySubmit={handleReplySubmit}
            onDeleteComment={handleDeleteComment}
            toggleReplies={toggleReplies}
            expanded={expandedCommentIds.includes(comment.commentId)}
            memberId={memberId} // 현재 로그인한 사용자 ID 전달
          />
        ))}
      </List>
      <Box sx={{ marginTop: 2 }}>
        <Divider sx={{ marginBottom: 2 }} />
        <TextField
          fullWidth
          multiline
          rows={4}
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          placeholder="댓글을 작성하세요"
          sx={{ marginBottom: 2 }}
        />
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCommentSubmit}
            disabled={commentContent.trim() === ""}
            sx={{
              marginLeft: "auto",
              backgroundColor: "white",
              color: "#6a4e23",
              boxShadow: "none",
              "&:hover": {
                backgroundColor: "#f5f5f5",
                boxShadow: "none", // 호버 시에도 그림자 제거
              },
            }}
          >
            댓글 작성
          </Button>
        </Box>
      </Box>

      {/* 페이지 네비게이션 */}
      <Box sx={{ marginTop: 3, display: "flex", justifyContent: "center" }}>
        <Pagination
          count={totalPages}
          page={page}
          onChange={(event, value) => setPage(value)}
          color="primary"
        />
      </Box>
    </Box>
  );
};

const CommentItem: React.FC<{
  comment: CommentDto;
  onReplySubmit: (parentCommentId: number, replyContent: string) => void;
  onDeleteComment: (commentId: number) => void;
  toggleReplies: (commentId: number) => void;
  expanded: boolean;
  memberId: number | null; // Redux에서 가져온 로그인된 사용자 ID
}> = ({
  comment,
  onReplySubmit,
  onDeleteComment,
  toggleReplies,
  expanded,
  memberId,
}) => {
  const [replyContent, setReplyContent] = useState<string>("");

  return (
    <Box sx={{ marginBottom: 2, paddingLeft: 2 }}>
      <Divider sx={{ marginBottom: 2, borderColor: "#6a4e23" }} />
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {comment.nickName}:
        </Typography>
        <Typography variant="body1" sx={{ marginLeft: 1 }}>
          {comment.content}
        </Typography>

        {/* 삭제 버튼 (댓글 작성자와 로그인한 사용자가 같을 경우에만 표시) */}
        {memberId === comment.memberId && (
          <Button
            size="small"
            onClick={() => onDeleteComment(comment.commentId)}
            sx={{
              marginLeft: 2,
              backgroundColor: "white",
              color: "#6a4e23",
              "&:hover": { backgroundColor: "#f5f5f5" },
            }}
          >
            삭제
          </Button>
        )}

        <Button
          size="small"
          onClick={() => toggleReplies(comment.commentId)}
          sx={{
            marginLeft: "auto",
            backgroundColor: "#ffffff",
            color: "#6a4e23",
            "&:hover": { backgroundColor: "#f5f5f5" },
          }}
        >
          {expanded ? "답글 숨기기" : "답글"}
        </Button>
      </Box>

      {expanded && comment.replies.length > 0 && (
        <Box sx={{ paddingLeft: 4 }}>
          <List sx={{ paddingLeft: 4 }}>
            {comment.replies.map((reply) => (
              <Box
                key={reply.commentId}
                sx={{ marginBottom: 1, paddingLeft: 4 }}
              >
                <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                  - {reply.nickName}: {reply.content}
                </Typography>

                {/* 대댓글 삭제 버튼 (작성자와 로그인한 사용자가 같을 경우에만 표시) */}
                {memberId === reply.memberId && (
                  <Button
                    size="small"
                    onClick={() => onDeleteComment(reply.commentId)}
                    sx={{
                      marginLeft: 2,
                      backgroundColor: "white",
                      color: "#6a4e23",
                      "&:hover": { backgroundColor: "#f5f5f5" },
                    }}
                  >
                    삭제
                  </Button>
                )}
              </Box>
            ))}
          </List>
        </Box>
      )}

      {expanded && (
        <Box sx={{ marginTop: 2, paddingLeft: 4 }}>
          <TextField
            fullWidth
            multiline
            rows={2}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="대댓글을 작성하세요"
            variant="outlined"
            sx={{
              marginBottom: 2,
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: "#6a4e23",
                },
                "&:hover fieldset": {
                  borderColor: "#6a4e23",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#6a4e23",
                },
              },
            }}
          />

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              onClick={() => {
                onReplySubmit(comment.commentId, replyContent);
                setReplyContent("");
              }}
              disabled={replyContent.trim() === ""}
              sx={{ color: "#6a4e23" }}
            >
              대댓글 작성
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Comment;
