export interface UserData {
  homeCity: string | null;
  favoriteCategories: string[];
  followedVenues: { venue: string; inCalendar: boolean }[];
  starred: string[];
  feedToken: string;
}

export interface AccountUser {
  id: string;
  email: string | null;
}
