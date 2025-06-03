// File: src/pages/api/admin/cleanup-holds.ts
// Updated to support both admin and CRON authentication

import type { APIRoute } from 'astro';
import { cleanupExpiredHolds, HoldError } from '../../../lib/holds';
import { authenticateRequest, createAuthenticatedResponse } from '../../../middleware/auth';

export const POST: APIRoute = async ({ request }) => {
  console.log('🧹 Cleanup holds endpoint accessed');
  
  // Get authorization header
  const authHeader = request.headers.get('Authorization');
  const userAgent = request.headers.get('User-Agent') || '';
  
  console.log('🔍 Authorization header present:', !!authHeader);
  console.log('🔍 User-Agent:', userAgent);
  
  let isAuthorized = false;
  let authMethod = '';
  
  // Method 1: Check for CRON job secret (for GitHub Actions)
  const cronSecret = process.env.CRON_JOB_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true;
    authMethod = 'CRON';
    console.log('✅ Authorized via CRON_JOB_SECRET');
  }
  
  // Method 2: Check for admin user authentication (for manual admin panel use)
  if (!isAuthorized) {
    const adminUser = await authenticateRequest(request);
    if (adminUser) {
      isAuthorized = true;
      authMethod = 'ADMIN';
      console.log('✅ Authorized via admin token');
    }
  }
  
  // If neither authentication method worked
  if (!isAuthorized) {
    console.warn('❌ Unauthorized cleanup attempt');
    console.log('🔍 Expected CRON secret configured:', !!cronSecret);
    console.log('🔍 Auth header format:', authHeader ? authHeader.substring(0, 20) + '...' : 'none');
    
    return new Response(JSON.stringify({
      error: 'Unauthorized access to cleanup endpoint',
      details: 'Valid admin token or CRON secret required',
      timestamp: new Date().toISOString()
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log(`🧹 Starting cleanup process (authorized via ${authMethod})`);
    const startTime = Date.now();
    
    const result = await cleanupExpiredHolds();
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Cleanup completed in ${processingTime}ms via ${authMethod}`);
    console.log('📊 Results:', result);
    
    return new Response(JSON.stringify({
      message: 'Expired holds cleanup process completed successfully',
      holdsDeleted: result.holdsDeleted,
      bookingsAbandoned: result.bookingsAbandoned,
      oldBookingsDeleted: result.oldBookingsDeleted,
      processingTimeMs: processingTime,
      authMethod: authMethod,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('❌ Cleanup process failed:', error);
    
    const errorCode = error instanceof HoldError ? error.code : 'UNKNOWN_ERROR';
    
    return new Response(JSON.stringify({
      error: 'Failed to cleanup expired holds',
      details: error.message,
      code: errorCode,
      authMethod: authMethod,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};