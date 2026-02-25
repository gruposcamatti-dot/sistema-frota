import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://golqvfbyfqsfynipcmyf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbHF2ZmJ5ZnFzZnluaXBjbXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Nzc2MDAsImV4cCI6MjA4NDE1MzYwMH0.Nrz6Cn0q_QeZLUd0lY5LfNQJ2o6P3rseVR_SPBce4ow';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);