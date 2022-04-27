import React, { ReactElement, useContext, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from 'react-query';
import request from 'graphql-request';
import { apiUrl } from '../../lib/config';
import AuthContext from '../../contexts/AuthContext';
import {
  Comment,
  POST_COMMENTS_QUERY,
  PostCommentsData,
} from '../../graphql/comments';
import { Post } from '../../graphql/posts';
import MainComment from '../comments/MainComment';

const PlaceholderCommentList = dynamic(
  () => import('../comments/PlaceholderCommentList'),
);

const DeleteCommentModal = dynamic(
  () => import('../modals/DeleteCommentModal'),
);

export interface ParentComment {
  authorName: string;
  authorImage: string;
  publishDate: Date | string;
  content: string;
  contentHtml: string;
  commentId: string | null;
  post: Post;
  editContent?: string;
  editId?: string;
}

interface PostCommentsProps {
  post: Post;
  onClick?: (parent: ParentComment) => unknown;
  onClickUpvote?: (commentId: string, upvotes: number) => unknown;
}

interface PendingComment {
  comment: Comment;
  parentId: string | null;
}

interface SharedData {
  editContent?: string;
  editId?: string;
}

const getParentComment = (
  post: Post,
  comment?: Comment,
  shared: SharedData = {},
) => {
  if (comment) {
    return {
      authorName: comment.author.name,
      authorImage: comment.author.image,
      content: comment.content,
      contentHtml: comment.contentHtml,
      publishDate: comment.lastUpdatedAt || comment.createdAt,
      commentId: comment.id,
      post,
      ...shared,
    };
  }

  return {
    authorName: post.source.name,
    authorImage: post.source.image,
    content: post.title,
    contentHtml: post.title,
    publishDate: post.createdAt,
    commentId: null,
    post,
    ...shared,
  };
};

export function PostComments({
  post,
  onClick,
  onClickUpvote,
}: PostCommentsProps): ReactElement {
  const { id } = post;
  const { user, showLogin, tokenRefreshed } = useContext(AuthContext);
  const [pendingComment, setPendingComment] = useState<PendingComment>(null);
  const { data: comments, isLoading: isLoadingComments } =
    useQuery<PostCommentsData>(
      ['post_comments', id],
      () =>
        request(`${apiUrl}/graphql`, POST_COMMENTS_QUERY, {
          postId: id,
        }),
      {
        enabled: !!id && tokenRefreshed,
        refetchInterval: 60 * 1000,
      },
    );
  const commentsCount = comments?.postComments?.edges?.length || 0;

  if (isLoadingComments) {
    return <PlaceholderCommentList placeholderAmount={post.numComments} />;
  }

  if (commentsCount === 0) {
    return (
      <div className="my-8 text-center text-theme-label-quaternary typo-subhead">
        Be the first to comment.
      </div>
    );
  }

  const onCommentClick = (comment: Comment, parentId: string | null) => {
    if (user) {
      const parent = getParentComment(post, comment);
      parent.commentId = parentId;

      onClick(parent);
    } else {
      showLogin('comment');
    }
  };

  const onEditClick = (comment: Comment, localParentComment?: Comment) => {
    const shared = { editContent: comment.content, editId: comment.id };
    onClick(getParentComment(post, localParentComment, shared));
  };

  return (
    <>
      {comments.postComments.edges.map((e, i) => (
        <MainComment
          className={i === commentsCount - 1 && 'mb-12'}
          comment={e.node}
          key={e.node.id}
          onComment={onCommentClick}
          onDelete={(comment, parentId) =>
            setPendingComment({ comment, parentId })
          }
          onEdit={onEditClick}
          onShowUpvotes={onClickUpvote}
          postAuthorId={post.author?.id}
        />
      ))}
      {pendingComment && (
        <DeleteCommentModal
          isOpen={!!pendingComment}
          onRequestClose={() => setPendingComment(null)}
          commentId={pendingComment.comment.id}
          parentId={pendingComment.parentId}
          postId={post.id}
          ariaHideApp={!(process?.env?.NODE_ENV === 'test')}
        />
      )}
    </>
  );
}