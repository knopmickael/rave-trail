CREATE TABLE campaigns (
  id text PRIMARY KEY,
  chapter_number integer NOT NULL UNIQUE CHECK (chapter_number > 0),
  title text NOT NULL,
  description text NOT NULL,
  background_path text NOT NULL,
  sort_order integer NOT NULL UNIQUE CHECK (sort_order >= 0),
  released boolean NOT NULL DEFAULT false
);
