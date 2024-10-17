import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to verify the password using Web Crypto API (PBKDF2)
async function verifyPassword(storedPassword: string, inputPassword: string): Promise<boolean> {
  const [saltString, hashString] = storedPassword.split(':'); // Split stored password into salt and hash
  const salt = Uint8Array.from(saltString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))); // Convert salt back to Uint8Array

  const enc = new TextEncoder().encode(inputPassword + salt); // Combine input password with stored salt
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc); // Hash the salted input password
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert hash to byte array
  const inputHashString = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // Convert bytes to hex

  return inputHashString === hashString; // Compare input hash with stored hash
}



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
      .select('userid, email, password, role')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({
        status: 400,
        message: 'Invalid email or user not found',
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Compare provided password with the stored hashed password
    const passwordMatch = await verifyPassword(user.password, password);

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
