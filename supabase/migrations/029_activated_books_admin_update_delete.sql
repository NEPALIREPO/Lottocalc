-- Allow admin to update and delete activated books (staff can only insert; no edit/delete in UI).

DROP POLICY IF EXISTS "Admin can update activated books" ON public.activated_books;
CREATE POLICY "Admin can update activated books" ON public.activated_books
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'ADMIN')
  WITH CHECK (public.get_my_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admin can delete activated books" ON public.activated_books;
CREATE POLICY "Admin can delete activated books" ON public.activated_books
  FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'ADMIN');
