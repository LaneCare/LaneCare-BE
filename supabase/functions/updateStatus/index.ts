import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const userid = (formData.get('userid') as string)?.trim();
    const status = (formData.get('status') as string)?.trim();
    const reportid = (formData.get('reportid') as string)?.trim();

    // 1. Validate the status
    const validStatuses = ['Submitted', 'On-Review', 'Declined', 'Verified'];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({
        status: 400,
        message: `Invalid status: ${status}. Valid statuses are ${validStatuses.join(', ')}`,
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // 2. Check if the user is admin or super admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('userid', userid)
      .single();

    if (userError || !userData) {
      return new Response(JSON.stringify({
        status: 400,
        message: `Invalid userid: ${userid}`,
        data: null
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const userRole = userData.role;

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return new Response(JSON.stringify({
        status: 403,
        message: 'User is not authorized to change the report status.',
        data: null
      }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    // 3. Update the status of the report if the user is authorized
    const { data: updatedReport, error: updateError } = await supabase
      .from('reports')
      .update({ status })
      .eq('reportid', reportid)
      .select()
      .single();

    if (updateError) {
      return new Response(JSON.stringify({
        status: 500,
        message: 'Error updating report status',
        data: null
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    // 4. Create a new entry in the report_log table
    const logData = {
      reportid: reportid,
      userid: userid,
      comments: `User ${userid} (${userRole}) updated the report status to ${status}`,
      status: status
    };

    const { error: logError } = await supabase
      .from('report_log')
      .insert([logData]);

    if (logError) {
      console.error('Error inserting log data:', logError);
      // Optionally handle the error, e.g., return a warning in the response
    }

    return new Response(JSON.stringify({
      status: 200,
      message: 'Report status updated successfully',
      data: { reportid, status }
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
