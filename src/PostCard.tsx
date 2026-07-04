import { Post } from "./hooks/useFeedData.ts";
import { getSourceColor } from "./utils.ts";

interface PostCardProps {
  post: Post;
  isRead: boolean;
  isActive: boolean;
  sourceLabel: string;
  onClick: () => void;
}

export function PostCard({
  post,
  isRead,
  isActive,
  sourceLabel,
  onClick,
}: PostCardProps) {
  const formattedDate = new Date(post.createdAt).toLocaleDateString("vi-VN");

  return (
    <div className={`post-card-container ${isRead ? "read-fade" : ""}`}>
      <a
        className={`post-card ${isActive ? "active" : ""}`}
        onClick={onClick}
      >
        <div className="post-meta">
          <span
            className="source-tag"
            style={getSourceColor(post.source)}
          >
            {sourceLabel}
          </span>
          <span>•</span>
          <span>Tác giả: {post.author}</span>
          <span>•</span>
          <span>{formattedDate}</span>
        </div>
        <h2 className="post-title" style={{ paddingRight: "24px" }}>
          {post.title}
        </h2>
        {post.summary && <p className="post-summary">{post.summary}</p>}
      </a>
    </div>
  );
}
