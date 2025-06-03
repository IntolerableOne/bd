<script>
  import { onMount, onDestroy } from 'svelte';
  import AdminHeader from './AdminHeader.svelte';
  import AdminCalendar from './AdminCalendar.svelte';
  import BookingsTable from './BookingsTable.svelte';

  let isAuthenticated = false;
  let email = '';
  let password = '';
  let authError = '';
  let dataLoadError = ''; 

  let selectedMidwife = 'clare';
  let slots = [];
  let bookings = [];
  let currentDate = new Date(); 
  let earnings = {
    monthly: {},
    yearly: 0
  };
  let loading = {
    slots: false,
    bookings: false
  };
  let viewDates = []; 
  let searchTerm = '';
  let filterMidwife = 'all';
  let filterDateRange = 'all';
  let showDebugInfo = false;
  let debugStats = {
    totalBookings: 0,
    paidBookings: 0,
    unpaidBookings: 0,
    abandonedBookings: 0,
    totalSlots: 0,
    availableSlots: 0,
    bookedSlots: 0,
    heldSlots: 0
  };

  // Email testing variables
  let emailConfigStatus = null;
  let testEmailAddress = '';
  let emailTesting = false;
  let emailTestResult = null;

  // Auto-cleanup variables
  let autoCleanupEnabled = true;
  let lastCleanupTime = null;
  let cleanupInterval = null;

  function getWeekDates(date) {
    const dates = [];
    const start = new Date(date);
    const dayOfWeek = start.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const newDate = new Date(start);
      newDate.setDate(start.getDate() + i);
      dates.push(newDate);
    }
    return dates;
  }

  $: viewDates = getWeekDates(currentDate);

  // Calculate debug statistics
  $: {
    const allBookingsCount = bookings.length;
    const paidCount = bookings.filter(b => b.paid).length;
    const unpaidCount = bookings.filter(b => !b.paid && b.status === 'PENDING').length;
    const abandonedCount = bookings.filter(b => b.status === 'ABANDONED').length;
    
    const totalSlotsCount = slots.length;
    const bookedSlotsCount = slots.filter(s => s.booking).length;
    const heldSlotsCount = slots.filter(s => s.hold && new Date(s.hold.expiresAt) > new Date()).length;
    const availableSlotsCount = slots.filter(s => !s.booking && (!s.hold || new Date(s.hold.expiresAt) <= new Date())).length;

    debugStats = {
      totalBookings: allBookingsCount,
      paidBookings: paidCount,
      unpaidBookings: unpaidCount,
      abandonedBookings: abandonedCount,
      totalSlots: totalSlotsCount,
      availableSlots: availableSlotsCount,
      bookedSlots: bookedSlotsCount,
      heldSlots: heldSlotsCount
    };
  }

  async function handleLogin() {
    authError = '';
    dataLoadError = '';
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (response.ok && data.token) {
        localStorage.setItem('adminToken', data.token);
        isAuthenticated = true;
        email = ''; 
        password = ''; 
        await loadData(); 
      } else {
        authError = data.error || 'Login failed. Please check your credentials.';
      }
    } catch (error) {
      console.error('Login request failed:', error);
      authError = 'Login request failed. Please try again.';
    }
  }

  function handleLogout() {
    localStorage.removeItem('adminToken');
    isAuthenticated = false;
    slots = [];
    bookings = [];
    earnings = { monthly: {}, yearly: 0 };
    authError = '';
    dataLoadError = '';
    stopAutoCleanup();
  }

  // Auto-cleanup functions
  function startAutoCleanup() {
    if (cleanupInterval) return; // Already running
    
    cleanupInterval = setInterval(async () => {
      if (autoCleanupEnabled && isAuthenticated) {
        console.log('🔄 Auto-triggering cleanup...');
        try {
          await triggerCleanup();
          lastCleanupTime = new Date();
        } catch (error) {
          console.error('Auto-cleanup failed:', error);
        }
      }
    }, 10 * 60 * 1000); // 10 minutes
  }
  
  function stopAutoCleanup() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }

  async function triggerCleanup() {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        dataLoadError = "Authentication required for cleanup operation.";
        return;
      }

      const response = await fetch('/api/admin/cleanup-holds', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Cleanup completed:', result);
        
        // Update UI with success message
        if (result.holdsDeleted > 0 || result.bookingsAbandoned > 0 || result.oldBookingsDeleted > 0) {
          dataLoadError = `✅ Cleanup: Removed ${result.holdsDeleted} expired holds, marked ${result.bookingsAbandoned} bookings as abandoned, deleted ${result.oldBookingsDeleted} old bookings.`;
        } else {
          dataLoadError = `✅ Cleanup: No expired items found.`;
        }
        
        // Reload data to reflect changes
        await loadData();
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          if (dataLoadError.startsWith('✅')) {
            dataLoadError = '';
          }
        }, 5000);
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        dataLoadError = `❌ Cleanup failed: ${errorData.error || 'Unknown error'}`;
      }
    } catch (error) {
      console.error('❌ Cleanup request failed:', error);
      dataLoadError = `❌ Cleanup request failed: ${error.message}`;
    }
  }

  // Email testing functions
  async function checkEmailConfig() {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/test-email', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        emailConfigStatus = data.environment;
      } else {
        emailConfigStatus = { error: 'Failed to check email config' };
      }
    } catch (error) {
      console.error('Email config check failed:', error);
      emailConfigStatus = { error: error.message };
    }
  }

  async function sendTestEmail(testType) {
    if (!testEmailAddress) {
      emailTestResult = { success: false, message: 'Please enter a test email address' };
      return;
    }

    emailTesting = true;
    emailTestResult = null;

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testType,
          recipientEmail: testEmailAddress
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        const testKey = testType === 'contact-form' ? 'contactForm' : 
                      testType === 'booking-confirmation' ? 'userConfirmation' : 'adminNotification';
        const result = data[testKey];
        emailTestResult = {
          success: result?.success || false,
          message: result?.success ? 'Test email sent successfully!' : (result?.error || 'Test failed')
        };
      } else {
        emailTestResult = { success: false, message: data.error || 'Test failed' };
      }
    } catch (error) {
      emailTestResult = { success: false, message: error.message };
    } finally {
      emailTesting = false;
      
      // Clear result after 5 seconds
      setTimeout(() => {
        emailTestResult = null;
      }, 5000);
    }
  }

  async function loadData() {
    if (!isAuthenticated) return;

    loading.slots = true;
    loading.bookings = true;
    
    let availabilityError = null;
    let bookingsError = null;

    try {
      await Promise.allSettled([
        loadAvailability().catch(e => { availabilityError = e.message || 'Failed to load availability slots.'; }),
        loadBookings().catch(e => { bookingsError = e.message || 'Failed to load booking data.'; })
      ]);

      if (availabilityError && bookingsError) {
        dataLoadError = `Failed to load availability (${availabilityError}) and bookings (${bookingsError}).`;
      } else if (availabilityError) {
        dataLoadError = availabilityError;
      } else if (bookingsError) {
        dataLoadError = bookingsError;
      } else {
        dataLoadError = '';
      }

    } catch (error) {
      console.error('Error loading admin data:', error);
      if (!dataLoadError) dataLoadError = 'An unexpected error occurred while loading admin data.';
    } finally {
      loading.slots = false;
      loading.bookings = false;
    }
  }

  async function loadAvailability() {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) throw new Error('Admin token not found.');

      const response = await fetch('/api/availability', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          authError = 'Your session has expired. Please log in again.';
          throw new Error('Session expired');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load availability (status: ${response.status})`);
      }
      slots = await response.json();
      console.log('Loaded slots:', slots.length);
    } catch (error) {
      console.error('Error loading availability:', error);
      slots = []; 
      throw error;
    }
  }

  async function loadBookings() {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) throw new Error('Admin token not found.');

      const response = await fetch('/api/booking', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          authError = 'Your session has expired. Please log in again.';
          throw new Error('Session expired');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load bookings (status: ${response.status})`);
      }
      const data = await response.json();
      bookings = data.bookings;
      earnings = data.earnings;
      console.log('Loaded bookings:', bookings.length, 'paid:', bookings.filter(b => b.paid).length);
    } catch (error) {
      console.error('Error loading bookings:', error);
      bookings = []; 
      earnings = { monthly: {}, yearly: 0 }; 
      throw error;
    }
  }

  async function handleAddSlot(event) {
    const { day, timeSlot } = event.detail;
    dataLoadError = ''; 
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        dataLoadError = "Authentication error. Please log in again.";
        if (!isAuthenticated) handleLogout();
        return;
      }
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: day.toISOString(), 
          startTime: timeSlot.start,
          endTime: timeSlot.end,
          midwife: selectedMidwife
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
            handleLogout();
            authError = 'Your session has expired. Please log in again.';
            return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to add slot (status: ${response.status})`);
      }
      await loadAvailability(); 
    } catch (error) {
      console.error('Error adding slot:', error);
      if (error.message !== 'Session expired') {
          dataLoadError = error.message || 'Error adding slot. Please try again.';
      }
    }
  }

  async function handleRemoveSlot(event) {
    const slotToRemove = event.detail; 
    if (!slotToRemove || !slotToRemove.id) {
        dataLoadError = "Cannot remove slot: Slot ID is missing.";
        return;
    }
    dataLoadError = ''; 
    try {
      const token = localStorage.getItem('adminToken');
        if (!token) {
        dataLoadError = "Authentication error. Please log in again.";
        if (!isAuthenticated) handleLogout();
        return;
      }
      const response = await fetch(`/api/availability/${slotToRemove.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        if (response.status === 401) {
            handleLogout();
            authError = 'Your session has expired. Please log in again.';
            return; 
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove slot (status: ${response.status})`);
      }
      await loadAvailability(); 
    } catch (error) {
      console.error('Error removing slot:', error);
      if (error.message !== 'Session expired') {
          dataLoadError = error.message || 'Error removing slot. Please try again.';
      }
    }
  }

  function previousPeriod() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7); 
    currentDate = newDate;
  }

  function nextPeriod() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7); 
    currentDate = newDate;
  }

  // Start auto-cleanup when component mounts and user is authenticated
  $: if (isAuthenticated && autoCleanupEnabled && !cleanupInterval) {
    startAutoCleanup();
  }

  onMount(async () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      isAuthenticated = true; 
      await loadData();
    }
  });

  // Cleanup on component destroy
  onDestroy(() => {
    stopAutoCleanup();
  });

  let filteredBookingsForTable = [];
  $: {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const sourceBookings = Array.isArray(bookings) ? bookings : [];
    filteredBookingsForTable = sourceBookings.filter(booking => {
        const matchesSearch = !searchTerm ||
            (booking.name && booking.name.toLowerCase().includes(lowerSearchTerm)) ||
            (booking.email && booking.email.toLowerCase().includes(lowerSearchTerm));

        const matchesMidwife = filterMidwife === 'all' ||
            (booking.availability && booking.availability.midwife === filterMidwife);

        let matchesDate = true;
        if (filterDateRange !== 'all' && booking.availability?.date) {
            const bookingDate = new Date(booking.availability.date);
            const now = new Date();
            now.setHours(0,0,0,0); 

            switch (filterDateRange) {
                case 'today':
                    matchesDate = bookingDate.toDateString() === now.toDateString();
                    break;
                case 'week': 
                    const currentWeekStart = getWeekDates(now)[0];
                    const currentWeekEnd = new Date(currentWeekStart);
                    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
                    currentWeekEnd.setHours(23,59,59,999);
                    matchesDate = bookingDate >= currentWeekStart && bookingDate <= currentWeekEnd;
                    break;
                case 'month': 
                    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    currentMonthEnd.setHours(23,59,59,999);
                    matchesDate = bookingDate >= currentMonthStart && bookingDate <= currentMonthEnd;
                    break;
            }
        }
        return matchesSearch && matchesMidwife && matchesDate;
    }).sort((a, b) => {
        const dateA = a.availability?.date ? new Date(a.availability.date).getTime() : 0;
        const dateB = b.availability?.date ? new Date(b.availability.date).getTime() : 0;
        return dateB - dateA;
    });
  }
</script>

<div class="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
  {#if !isAuthenticated}
    <div class="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-xl">
      <h2 class="text-2xl font-bold mb-6 text-center text-gray-700">Admin Login</h2>
      <form on:submit|preventDefault={handleLogin} class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            id="email"
            bind:value={email}
            class="w-full px-4 py-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
            required
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            id="password"
            bind:value={password}
            class="w-full px-4 py-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
            required
            placeholder="••••••••"
          />
        </div>
        {#if authError}
          <p class="text-red-600 text-sm p-3 bg-red-50 rounded-md border border-red-200">{authError}</p>
        {/if}
        <button
          type="submit"
          class="w-full bg-green-700 text-white rounded-md py-3 px-4 font-semibold hover:bg-green-800 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
          Login
        </button>
      </form>
    </div>
  {:else}
    <div class="space-y-8">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4 pb-4 border-b border-gray-200">
        <h1 class="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <div class="flex gap-2">
          <button
            on:click={() => showDebugInfo = !showDebugInfo}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            {showDebugInfo ? 'Hide' : 'Show'} Debug Info
          </button>
          <button
            on:click={triggerCleanup}
            class="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors">
            Clean Expired Holds
          </button>
          <button
            on:click={handleLogout}
            class="px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
            Logout
          </button>
        </div>
      </div>

      {#if showDebugInfo}
        <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 class="text-lg font-semibold text-blue-800 mb-3">System Debug Information</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div class="bg-white p-3 rounded border">
              <div class="text-blue-600 font-medium">Total Bookings</div>
              <div class="text-xl font-bold">{debugStats.totalBookings}</div>
            </div>
            <div class="bg-white p-3 rounded border">
              <div class="text-green-600 font-medium">Paid Bookings</div>
              <div class="text-xl font-bold text-green-700">{debugStats.paidBookings}</div>
            </div>
            <div class="bg-white p-3 rounded border">
              <div class="text-yellow-600 font-medium">Pending Bookings</div>
              <div class="text-xl font-bold text-yellow-700">{debugStats.unpaidBookings}</div>
            </div>
            <div class="bg-white p-3 rounded border">
              <div class="text-orange-600 font-medium">Abandoned Bookings</div>
              <div class="text-xl font-bold text-orange-700">{debugStats.abandonedBookings}</div>
            </div>
            <div class="bg-white p-3 rounded border">
              <div class="text-gray-600 font-medium">Total Slots</div>
              <div class="text-xl font-bold">{debugStats.totalSlots}</div>
            </div>
            <div class="bg-white p-3 rounded border">
              <div class="text-green-600 font-medium">Available Slots</div>
              <div class="text-xl font-bold">{debugStats.availableSlots}</div>
            </div>
            <div class="bg-white p-3 rounded border">
              <div class="text-gray-600 font-medium">Booked Slots</div>
              <div class="text-xl font-bold">{debugStats.bookedSlots}</div>
            </div>
            <div class="bg-white p-3 rounded border">
              <div class="text-yellow-600 font-medium">Held Slots</div>
              <div class="text-xl font-bold text-yellow-700">{debugStats.heldSlots}</div>
            </div>
          </div>

          <!-- Auto-cleanup status -->
          <div class="mt-4 pt-4 border-t border-blue-200">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-semibold text-blue-800">Auto-Cleanup Status</h4>
              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  bind:checked={autoCleanupEnabled}
                  class="rounded"
                />
                <span class="text-sm">Enable Auto-Cleanup</span>
              </label>
            </div>
            <div class="text-sm text-blue-700">
              <p>Status: {autoCleanupEnabled ? '🟢 Active' : '🔴 Disabled'}</p>
              {#if lastCleanupTime}
                <p>Last cleanup: {lastCleanupTime.toLocaleTimeString()}</p>
              {/if}
              <p class="text-xs text-blue-600 mt-1">
                Auto-cleanup runs every 10 minutes while admin panel is open
              </p>
            </div>
          </div>
        </div>

        <!-- Email Testing Section -->
        <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h3 class="text-lg font-semibold text-purple-800 mb-3">Email System Testing</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Email Configuration Status -->
            <div class="bg-white p-3 rounded border">
              <h4 class="font-medium text-purple-700 mb-2">Configuration Status</h4>
              <button
                on:click={checkEmailConfig}
                class="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 mb-2">
                Check Email Config
              </button>
              {#if emailConfigStatus}
                <div class="text-xs space-y-1">
                  <div class="flex justify-between">
                    <span>SMTP Host:</span>
                    <span class="{emailConfigStatus.EMAIL_HOST === 'SET' ? 'text-green-600' : 'text-red-600'}">
                      {emailConfigStatus.EMAIL_HOST}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span>Email User:</span>
                    <span class="{emailConfigStatus.EMAIL_USER === 'SET' ? 'text-green-600' : 'text-red-600'}">
                      {emailConfigStatus.EMAIL_USER}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span>Team Address:</span>
                    <span class="{emailConfigStatus.TEAM_EMAIL_ADDRESS !== 'NOT SET' ? 'text-green-600' : 'text-red-600'}">
                      {emailConfigStatus.TEAM_EMAIL_ADDRESS !== 'NOT SET' ? 'SET' : 'NOT SET'}
                    </span>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Email Testing -->
            <div class="bg-white p-3 rounded border">
              <h4 class="font-medium text-purple-700 mb-2">Send Test Emails</h4>
              <div class="space-y-2">
                <input
                  type="email"
                  placeholder="Test email address"
                  bind:value={testEmailAddress}
                  class="w-full px-2 py-1 border rounded text-sm">
                
                <div class="flex gap-2">
                  <button
                    on:click={() => sendTestEmail('contact-form')}
                    class="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    disabled={emailTesting}>
                    Test Contact
                  </button>
                  <button
                    on:click={() => sendTestEmail('booking-confirmation')}
                    class="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    disabled={emailTesting}>
                    Test Booking
                  </button>
                  <button
                    on:click={() => sendTestEmail('admin-notification')}
                    class="px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
                    disabled={emailTesting}>
                    Test Admin
                  </button>
                </div>
                
                {#if emailTestResult}
                  <div class="text-xs p-2 rounded {emailTestResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    {emailTestResult.message}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if authError && !dataLoadError}
        <div class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg border border-red-300" role="alert">
          <span class="font-medium">Session Error:</span> {authError}
        </div>
      {/if}
      {#if dataLoadError}
        <div class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg border border-red-300" role="alert">
          <span class="font-medium">System Message:</span> {dataLoadError}
        </div>
      {/if}

      <AdminHeader {earnings} {bookings} {slots} />

      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl font-bold mb-6 text-gray-700">Manage Availability</h2>
        <div class="flex flex-col sm:flex-row gap-4 mb-6">
          <button
            class="flex-1 px-4 py-3 rounded-lg transition-all duration-150 ease-in-out font-medium text-lg
                   {selectedMidwife === 'clare' ? 'bg-green-700 text-white shadow-md scale-105' : 'border-2 border-green-600 text-green-700 hover:bg-green-50'}"
            on:click={() => selectedMidwife = 'clare'}>
            Clare
          </button>
          <button
            class="flex-1 px-4 py-3 rounded-lg transition-all duration-150 ease-in-out font-medium text-lg
                   {selectedMidwife === 'natalie' ? 'bg-green-700 text-white shadow-md scale-105' : 'border-2 border-green-600 text-green-700 hover:bg-green-50'}"
            on:click={() => selectedMidwife = 'natalie'}>
            Natalie
          </button>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <button
            on:click={previousPeriod}
            class="px-5 py-2.5 rounded-lg border border-green-700 text-green-700 font-medium hover:bg-green-50 transition-colors w-full md:w-auto">
            &larr; Previous Week
          </button>
          <h3 class="text-xl font-semibold text-gray-700 text-center">
            {viewDates[0]?.toLocaleDateString('en-GB', { month: 'long', day: 'numeric' })} -
            {viewDates[6]?.toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          <button
            on:click={nextPeriod}
            class="px-5 py-2.5 rounded-lg border border-green-700 text-green-700 font-medium hover:bg-green-50 transition-colors w-full md:w-auto">
            Next Week &rarr;
          </button>
        </div>
        
        {#if loading.slots}
            <div class="text-center py-10">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto"></div>
                <p class="mt-3 text-gray-600">Loading availability...</p>
            </div>
        {:else}
            <AdminCalendar
              {selectedMidwife}
              {slots} 
              {viewDates}
              on:addSlot={handleAddSlot}
              on:removeSlot={handleRemoveSlot}
            />
        {/if}
      </div>

      <div class="bg-white p-6 rounded-lg shadow-lg space-y-6">
        <h2 class="text-2xl font-bold text-gray-700">Client Bookings</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div class="md:col-span-1">
            <label for="searchTerm" class="block text-sm font-medium text-gray-700 mb-1">Search Bookings</label>
            <input
              type="text"
              id="searchTerm"
              placeholder="Search by name or email..."
              bind:value={searchTerm}
              class="w-full px-4 py-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label for="filterMidwife" class="block text-sm font-medium text-gray-700 mb-1">Filter by Midwife</label>
            <select
              id="filterMidwife"
              bind:value={filterMidwife}
              class="w-full px-4 py-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-green-500">
              <option value="all">All Midwives</option>
              <option value="clare">Clare</option>
              <option value="natalie">Natalie</option>
            </select>
          </div>
          <div>
            <label for="filterDateRange" class="block text-sm font-medium text-gray-700 mb-1">Filter by Date</label>
            <select
              id="filterDateRange"
              bind:value={filterDateRange}
              class="w-full px-4 py-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-green-500">
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
         {#if loading.bookings}
            <div class="text-center py-10">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto"></div>
                <p class="mt-3 text-gray-600">Loading bookings...</p>
            </div>
        {:else}
            <BookingsTable
              bookings={filteredBookingsForTable}
            />
        {/if}
      </div>
    </div>
  {/if}
</div>