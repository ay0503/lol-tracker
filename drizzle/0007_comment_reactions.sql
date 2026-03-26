CREATE TABLE IF NOT EXISTS comment_reactions (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  userId integer NOT NULL,
  commentId integer NOT NULL,
  type text NOT NULL,
  createdAt text DEFAULT (datetime('now')) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reaction_unique ON comment_reactions(userId, commentId, type);
CREATE INDEX IF NOT EXISTS idx_reaction_comment ON comment_reactions(commentId);
