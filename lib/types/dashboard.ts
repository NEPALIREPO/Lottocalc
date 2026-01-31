/** Shared dashboard types for admin and staff clients */

export interface Box {
  id: string;
  box_number: number | null;
  name: string;
  ticket_value: number;
  category: string;
}

export interface Entry {
  id: string;
  date: string;
  box_id: string;
  open_number: number | null;
  close_number: number | null;
  new_box_start_number: number | null;
  activated_book_id: string | null;
  sold_count?: number | null;
  sold_amount?: number | null;
  boxes: Box;
  activated_books?: {
    id: string;
    start_ticket_number: number;
    activated_date: string;
    ticket_count: number;
    note: string | null;
  } | null;
}

export interface Player {
  id: string;
  name: string;
}

/** Activated book for a specific date (used to link to daily box entries) */
export interface ActivatedBookForDate {
  id: string;
  box_id: string;
  start_ticket_number: number;
  activated_date: string;
  ticket_count: number;
  note: string | null;
}

export interface ActivatedBookRow {
  id: string;
  box_id: string;
  activated_date: string;
  start_ticket_number: number;
  ticket_count: number;
  note: string | null;
  created_at: string;
  boxes: { box_number: number | null; name: string; ticket_value: number } | null;
}
