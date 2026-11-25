export interface Group {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string;
}

export interface RawMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string } | { username: string }[] | null;
}
