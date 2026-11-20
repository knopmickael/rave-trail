-- Legacy matches cannot acquire exact historical counters simply by playing another turn.
ALTER TABLE battles ADD COLUMN counters_exact boolean NOT NULL DEFAULT false;
