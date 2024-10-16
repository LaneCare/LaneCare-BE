// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://deno.land/x/bcrypt/mod.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      status: 405,
      message: 'Method Not Allowed',
      data: null
    }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  try {
    const formData = await req.formData();

    // Extract fields from formData
    const name = (formData.get('name') as string)?.trim();
    const email = (formData.get('email') as string)?.trim();
    const password = (formData.get('password') as string)?.trim();
    const role = (formData.get('role') as string)?.trim();

    // Validate inputs
    if (!name || !email || !password || !role) {
      return new Response(JSON.stringify({
        status: 400,
        message: 'Missing required field: name, email, password, or role',
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Validate role
    const validRoles = ['user', 'admin', 'super_admin'];
    if (!validRoles.includes(role.toLowerCase())) {
      return new Response(JSON.stringify({
        status: 400,
        message: `Invalid role: ${role}. Valid roles are ${validRoles.join(', ')}`,
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Check if email already exists
    const { data: existingUser, error: emailCheckError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (emailCheckError) {
      console.error('Error checking email:', emailCheckError);
      return new Response(JSON.stringify({
        status: 500,
        message: 'Error checking email',
        data: null
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    if (existingUser) {
      return new Response(JSON.stringify({
        status: 400,
        message: 'Email already exists',
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password);

    // Insert new user into the database
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        name,
        email,
        password: hashedPassword,
        role
      }]);

    if (insertError) {
      console.error('Error inserting new user:', insertError);
      return new Response(JSON.stringify({
        status: 500,
        message: 'Error registering user',
        data: null
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      status: 200,
      message: 'User registered successfully',
      data: newUser
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      status: 500,
      message: 'Internal Server Error',
      data: null
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});


/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/register' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
