export interface UserInfo {
  username: string;
  role: string;
}

export interface NavItem {
  title: string;
  url: string;
  icon?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updated: string;
}

export interface NoteCategory {
  id: string;
  name: string;
  notes: Note[];
}

export interface Song {
  title: string;
  filename: string;
  relative_path: string;
  path: string;
  duration: number;
}

export interface Playlist {
  name: string;
  path: string;
  songs: Song[];
}

export interface DashboardData {
  notes: Note[];
  note_categories: NoteCategory[];
  software: NavItem[];
  websites: NavItem[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
