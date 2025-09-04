import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kijtilvptttqcwgrzyxh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpanRpbHZwdHR0cWN3Z3J6eXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MDM1NjUsImV4cCI6MjA3MTI3OTU2NX0.ZxM509gy7oPLR2Zw328aG8pjVDTLIbICo1ih0kV4W4E";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
