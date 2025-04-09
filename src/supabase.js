
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://thhmwaiirjvgwmyjjvkh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoaG13YWlpcmp2Z3dteWpqdmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxNjkxMjAsImV4cCI6MjA1OTc0NTEyMH0.lULlbR9LQ5hLNyJsBCOeFWMsf4I61Qp_fhLeO1GgyfQ";

export const supabase = createClient(supabaseUrl, supabaseKey);
