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
    const email = (formData.get('email') as string)?.trim();
    const password = (formData.get('password') as string)?.trim();

    // Validate inputs
    if (!email || !password) {
      return new Response(JSON.stringify({
        status: 400,
        message: 'Missing required field: email or password',
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Check if user exists with the provided email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password, role')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({
        status: 400,
        message: 'Invalid email or user not found',
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Compare provided password with the stored hashed password using bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return new Response(JSON.stringify({
        status: 400,
        message: 'Invalid password',
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Login successful, return user data excluding password
    const { password: _, ...userData } = user;

    return new Response(JSON.stringify({
      status: 200,
      message: 'Login successful',
      data: userData
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
