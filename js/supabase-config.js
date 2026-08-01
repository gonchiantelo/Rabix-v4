/* 
    RAVIX V5 - SUPABASE CONFIGURATION
    Centralized initialization to avoid duplicated credentials.
*/

window.SUPA_URL = 'https://rscdpwarzltozigfbmev.supabase.co';
window.SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzY2Rwd2Fyemx0b3ppZ2ZibWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjYyNjUsImV4cCI6MjA5MTg0MjI2NX0.WaKWoCxbaQ3VVDXLtfBvNyB9zywxZRHCwjzT-5gS-b0';

window.SUPABASE_URL = window.SUPA_URL;
window.SUPABASE_KEY = window.SUPA_KEY;

// Create the global supabase client once
window.supabaseClient = window.supabase || (typeof supabase !== 'undefined' ? supabase.createClient(window.SUPA_URL, window.SUPA_KEY) : null);
if (!window.supabase) {
    window.supabase = window.supabaseClient;
}
