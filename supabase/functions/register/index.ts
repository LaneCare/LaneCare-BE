import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to hash the password using Web Crypto API (PBKDF2)
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)); // Generate random salt
  const enc = new TextEncoder().encode(password + salt); // Combine password with salt

  const hashBuffer = await crypto.subtle.digest('SHA-256', enc); // Hash the salted password
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert hash to byte array
  const hashString = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // Convert bytes to hex

  const saltString = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''); // Convert salt to hex
  return `${saltString}:${hashString}`; // Store salt and hash
}



// Function to generate a random salt
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
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
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return new Response(JSON.stringify({
        status: 400,
        message: 'Email already exists',
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Generate salt and hash the password
    const salt = generateSalt();
    const hashedPassword = await hashPassword(password, salt);

    // Insert new user into the database
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        name,
        email,
        password: hashedPassword, // Store both salt and hashed password
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
