CREATE TABLE public.fine_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrowing_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  phone_last3 text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  checkout_request_id text UNIQUE,
  mpesa_receipt text,
  result_desc text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.fine_payments TO service_role;
ALTER TABLE public.fine_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX fine_payments_borrowing_idx ON public.fine_payments(borrowing_id);
CREATE UNIQUE INDEX fine_payments_one_paid ON public.fine_payments(borrowing_id) WHERE status = 'paid';