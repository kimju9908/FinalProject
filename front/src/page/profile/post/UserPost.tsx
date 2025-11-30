import React from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
// import striptags from "striptags";

// 게시글 DTO 타입 정의
interface ForumPostResponseDto {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

// 스타일 컴포넌트
const Card = styled.div`
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: 0.2s ease-in-out;
  cursor: pointer;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Excerpt = styled.p`
  font-size: 14px;
  color: #666;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2; /* 최대 2줄 */
  -webkit-box-orient: vertical;
`;

const Timestamp = styled.span`
  font-size: 12px;
  color: #999;
`;

const PostContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 600px;
  margin: auto;
`;

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

// 게시글 리스트 컴포넌트
const UserPost: React.FC<{ posts: ForumPostResponseDto[] }> = ({ posts }) => {
  const navigate = useNavigate();

  const handlePostClick = (id: string) => {
    navigate(`/forum/post/${id}`);
  };

  return (
    <PostContainer>
      {posts.map((post) => (
        <Card key={post.id} onClick={() => handlePostClick(post.id)}>
          <Title>{post.title}</Title>
          {/* <Excerpt>{striptags(post.content).slice(0, 10)}...</Excerpt> */}
          <Timestamp>{new Date(post.createdAt).toLocaleDateString()}</Timestamp>
        </Card>
      ))}
    </PostContainer>
  );
};

export default UserPost;
