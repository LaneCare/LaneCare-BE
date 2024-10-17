// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  console.log('Using Supabase Project URL:', supabaseUrl);

  console.log('Using Supabase Service Role Key:', supabaseKey.substring(0, 6) + '...'); 

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      status: 405,
      message: 'Method Not Allowed',
      data: null
    }), { status: 405, headers: { "Content-Type": "application/json" } });
  }
  
  try {
    const formData = await req.formData();
    
    // Extract required fields from the formData
    const userid = formData.get('userid');
    const latitude = formData.get('latitude');
    const longitude = formData.get('longitude');
    const description = formData.get('description');
    const is_iot = formData.get('is_iot');
    const iot_id = formData.get('iot_id');
    const file = formData.get('file') as File;

    // Check for missing required fields
    const requiredFields = ['userid', 'latitude', 'longitude', 'description',  'is_iot'];
    for (const field of requiredFields) {
      if (!formData.has(field)) {
        return new Response(JSON.stringify({
          status: 400,
          message: `Missing required field: ${field}`,
          data: null
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    // 1. Check if the userid exists in the users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('userid')
      .eq('userid', userid)
      .single();

    if (userError || !userData) {
      return new Response(JSON.stringify({
        status: 400,
        message: `Invalid userid: ${userid}`,
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // 2. If is_iot is true, check if iot_id exists and matches the userid
    const data = {
      userid,
      latitude,
      longitude,
      description,
      status: 'Submitted', // Automatically setting status to 'Submitted'
      is_iot: is_iot === 'true', // Convert string to boolean
      iot_id: null,
    };

    if (is_iot === 'true' && iot_id) {
      const { data: iotData, error: iotError } = await supabase
        .from('iot_devices')
        .select('deviceid, userid')
        .eq('deviceid', iot_id)
        .single();

      if (iotError || !iotData || iotData.userid !== userid) {
        return new Response(JSON.stringify({
          status: 400,
          message: `Invalid iot_id or iot_id does not belong to userid: ${userid}`,
          data: null
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      data.iot_id = iot_id;
    } else if (is_iot === 'true' && !iot_id) {
      return new Response(JSON.stringify({
        status: 400,
        message: 'Missing iot_id for IoT report',
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Upload file to Supabase Storage
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
      console.error('Error listing buckets:', bucketError);
      return new Response(JSON.stringify({
        status: 500,
        message: 'Error accessing storage buckets',
        data: null
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    let imageUrl = '';
    if (file) {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('Report_Bucket')
        .upload(`${Date.now()}_${file.name}`, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return new Response(JSON.stringify({
          status: 500,
          message: 'Error uploading file',
          data: null
        }), { status: 500, headers: { "Content-Type": "application/json" } });
      }

      const { data: { publicUrl } } = supabase.storage
        .from('Report_Bucket')
        .getPublicUrl(uploadData.path);

      imageUrl = publicUrl;
    }

    // Add imageUrl to data
    data.imageurl = imageUrl;

    // Insert data into the database
    const { data: insertedData, error: insertError } = await supabase
      .from('reports')
      .insert([data]);

    if (insertError) {
      console.error('Error inserting data:', insertError);
      return new Response(JSON.stringify({
        status: 500,
        message: 'Error inserting data into database',
        data: null
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      status: 200,
      message: 'Data uploaded successfully',
      data: insertedData
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


