<script>
  import { onMount } from 'svelte';
  import AdminHeader from './AdminHeader.svelte';
  import AdminCalendar from './AdminCalendar.svelte';
  import BookingsTable from './BookingsTable.svelte';
  
  let isAuthenticated = false;
  let email = '';
  let password = '';
  let authError = '';
  let authToken = '';

  // Admin panel state
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
    bookings: false,
    cleanupHolds: false
  };
  let selectedView = 'week';
  let viewDates = [];
  let searchTerm = '';
  let filterStatus = 'all';
  let filterMidwife = 'all';
  let filterDateRange = 'all';
  let cleanupMessage = '';

  function getWeekDates(date) {
    const dates = [];
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // Go to the start of week
    start.setHours(0, 0, 0, 0); // Reset time part
    
    for (let i = 0; i < 7; i++) {
      const newDate = new Date(start);
      newDate.setDate(start.getDate() + i);
      dates.push(newDate);
    }
    return dates;
  }

  // Initialize viewDates
  $: {
    viewDates = getWeekDates(currentDate);
  }

  async function handleLogin() {
    authError = '';
    try {
      console.log('Attempting login with email:', email);
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        console.log('Login successful, token received');
        localStorage.setItem('adminToken', data.token);
        authToken = data.token;
        isAuthenticated = true;
        email = '';
        password = '';
        await loadData();
      } else {
        console.error('Login failed:', data.error);
        authError = data.error || 'Login failed';
      }
    } catch (error) {
      console.error('Login error:', error);
      authError = 'Login failed. Please try again.';
    }
  }

  function handleLogout() {
    console.log('Logging out');
    localStorage.removeItem('adminToken');
    authToken = '';
    isAuthenticated = false;
    slots = [];
    bookings = [];
  }

  async function loadData() {
    loading.slots = true;
    loading.bookings = true;
    
    try {
      await Promise.all([
        loadAvailability(),
        loadBookings()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      loading.slots = false;
      loading.bookings = false;
    }
  }

  async function loadAvailability() {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.error('No admin token found');
        throw new Error('Authentication required');
      }
      
      console.log('Loading availability with token');
      const response = await fetch('/api/availability', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 401) {
        console.error('Authentication failed when loading availability');
        handleLogout();
        throw new Error('Session expired. Please login again.');
      }
      
      if (!response.ok) {
        throw new Error('Failed to load availability');
      }
      
      slots = await response.json();
      console.log(`Loaded ${slots.length} slots`);
    } catch (error) {
      console.error('Error loading availability:', error);
      if (error.message.includes('Session expired')) {
        authError = error.message;
      }
    }
  }

  async function loadBookings() {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.error('No admin token found');
        throw new Error('Authentication required');
      }
      
      console.log('Loading bookings with token');
      const response = await fetch('/api/booking', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 401) {
        console.error('Authentication failed when loading bookings');
        handleLogout();
        throw new Error('Session expired. Please login again.');
      }
      
      if (!response.ok) {
        throw new Error('Failed to load bookings');
      }
      
      const data = await response.json();
      bookings = data.bookings || [];
      earnings = data.earnings || { monthly: {}, yearly: 0 };
      console.log(`Loaded ${bookings.length} bookings`);
    } catch (error) {
      console.error('Error loading bookings:', error);
      if (error.message.includes('Session expired')) {
        authError = error.message;
      }
    }
  }

  async function handleAddSlot(event) {
    const { day, timeSlot } = event.detail;
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.error('No admin token found');
        throw new Error('Authentication required');
      }
      
      console.log(`Adding slot for ${day} at ${timeSlot.start}`);
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: day,
          startTime: timeSlot.start,
          endTime: timeSlot.end,
          midwife: selectedMidwife
        })
      });
      
      if (response.status === 401) {
        console.error('Authentication failed when adding slot');
        handleLogout();
        throw new Error('Session expired. Please login again.');
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add slot');
      }
      
      console.log('Slot added successfully');
      await loadAvailability();
    } catch (error) {
      console.error('Error adding slot:', error);
      if (error.message.includes('Session expired')) {
        authError = error.message;
      }
    }
  }

  async function handleRemoveSlot(event) {
    const slot = event.detail;
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.error('No admin token found');
        throw new Error('Authentication required');
      }
      
      console.log(`Removing slot ${slot.id}`);
      const response = await fetch(`/api/availability/${slot.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 401) {
        console.error('Authentication failed when removing slot');
        handleLogout();
        throw new Error('Session expired. Please login again.');
      }
      
      if (!response.ok) {
        throw new Error('Failed to remove slot');
      }
      
      console.log('Slot removed successfully');
      await loadAvailability();
    } catch (error) {
      console.error('Error removing slot:', error);
      if (error.message.includes('Session expired')) {
        authError = error.message;
      }
    }
  }

  async function cleanupExpiredHolds() {
    loading.cleanupHolds = true;
    cleanupMessage = '';
    
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.error('No admin token found');
        throw new Error('Authentication required');
      }
      
      console.log('Cleaning up expired holds');
      const response = await fetch('/api/admin/cleanup-holds', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 401) {
        console.error('Authentication failed when cleaning up holds');
        handleLogout();
        throw new Error('Session expired. Please login again.');
      }
      
      if (!response.ok) {
        throw new Error('Failed to clean up expired holds');
      }
      
      const data = await response.json();
      cleanupMessage = data.message || 'Cleanup completed successfully';
      console.log('Cleanup completed:', cleanupMessage);
      
      // Reload data after cleanup
      await loadData();
    } catch (error) {
      console.error('Error cleaning up expired holds:', error);
      cleanupMessage = 'Failed to clean up expired holds: ' + (error.message || '');
      if (error.message.includes('Session expired')) {
        authError = error.message;
      }
    } finally {
      loading.cleanupHolds = false;
      // Auto-hide message after 5 seconds
      setTimeout(() => {
        cleanupMessage = '';
      }, 5000);
    }
  }

  function previousPeriod() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    currentDate = newDate;
    viewDates = getWeekDates(currentDate);
  }

  function nextPeriod() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    currentDate = newDate;
    viewDates = getWeekDates(currentDate);
  }

  onMount(async () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      console.log('Found admin token in localStorage, attempting to use it');
      authToken = token;
      isAuthenticated = true;
      
      try {
        await loadData();
      } catch (error) {
        console.error('Failed to load data with saved token:', error);
        // If loading fails with the saved token, clear it and show login
        if (error.message.includes('Authentication')) {
          handleLogout();
        }
      }

      // Set up auto-refresh every minute
      const refreshInterval = setInterval(() => {
        if (isAuthenticated) {
          loadData();
        } else {
          clearInterval(refreshInterval);
        }
      }, 60000);

      return () => {
        clearInterval(refreshInterval);
      };
    } else {
      console.log('No admin token found, showing login screen');
    }
  });
</script>

<div class="w-full max-w-6xl mx-auto p-4">
  {#if !isAuthenticated}
    <div class="max-w-md mx-auto">
      <h2 class="text-2xl font-bold mb-6 text-center">Admin Login</h2>
      <form on:submit|preventDefault={handleLogin} class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            id="email"
            bind:value={email}
            class="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
            required
          />
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            id="password"
            bind:value={password}
            class="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500"
            required
          />
        </div>
        {#if authError}
          <p class="text-red-500 text-sm">{authError}</p>
        {/if}
        <button
          type="submit"
          class="w-full bg-green-700 text-white rounded-md py-2 px-4 hover:bg-green-800 transition-colors">
          Login
        </button>
      </form>
    </div>
  {:else}
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 class="text-2xl font-bold">Admin Panel</h1>
        <div class="flex gap-2">
          <button
            on:click={cleanupExpiredHolds}
            disabled={loading.cleanupHolds}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading.cleanupHolds ? 'Cleaning...' : 'Cleanup Expired Holds'}
          </button>
          <button
            on:click={handleLogout}
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            Logout
          </button>
        </div>
      </div>

      {#if authError}
        <div class="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg">
          {authError}
        </div>
      {/if}

      {#if cleanupMessage}
        <div class="bg-blue-50 border border-blue-200 text-blue-600 p-3 rounded-lg">
          {cleanupMessage}
        </div>
      {/if}

      <!-- Stats Overview -->
      <AdminHeader {earnings} {bookings} {slots} />

      <!-- Calendar Section -->
      <div class="bg-white p-6 rounded-lg shadow">
        <h2 class="text-xl font-bold mb-4">Add Availability</h2>
        
        <!-- Midwife Selection -->
        <div class="flex gap-4 mb-6">
          <button 
            class="flex-1 px-4 py-3 rounded-lg transition-colors {selectedMidwife === 'clare' ? 'bg-green-700 text-white' : 'border-2 border-green-700 text-green-700'}"
            on:click={() => selectedMidwife = 'clare'}>
            Clare
          </button>
          <button 
            class="flex-1 px-4 py-3 rounded-lg transition-colors {selectedMidwife === 'natalie' ? 'bg-green-700 text-white' : 'border-2 border-green-700 text-green-700'}"
            on:click={() => selectedMidwife = 'natalie'}>
            Natalie
          </button>
        </div>

        <!-- Navigation -->
        <div class="flex justify-between items-center mb-6">
          <button 
            on:click={previousPeriod}
            class="px-4 py-2 rounded-lg border border-green-700 text-green-700 hover:bg-green-50">
            Previous Week
          </button>
          <h3 class="text-lg font-semibold">
            {viewDates[0]?.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - 
            {viewDates[6]?.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
          </h3>
          <button 
            on:click={nextPeriod}
            class="px-4 py-2 rounded-lg border border-green-700 text-green-700 hover:bg-green-50">
            Next Week
          </button>
        </div>

        <!-- Calendar Headers -->
        <div class="hidden md:grid grid-cols-7 gap-2 mb-2">
          {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
            <div class="text-center font-semibold py-2">{day}</div>
          {/each}
        </div>

        {#if loading.slots}
          <div class="text-center py-10">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-700"></div>
            <p class="mt-2 text-gray-600">Loading calendar data...</p>
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

      <!-- Search and Filters -->
      <div class="bg-white p-6 rounded-lg shadow space-y-4">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              bind:value={searchTerm}
              class="w-full px-4 py-2 border rounded-md"
            />
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <select
              bind:value={filterMidwife}
              class="px-4 py-2 border rounded-md">
              <option value="all">All Midwives</option>
              <option value="clare">Clare</option>
              <option value="natalie">Natalie</option>
            </select>
            <select
              bind:value={filterStatus}
              class="px-4 py-2 border rounded-md">
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              bind:value={filterDateRange}
              class="px-4 py-2 border rounded-md">
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Bookings Table -->
      {#if loading.bookings}
        <div class="bg-white p-6 rounded-lg shadow text-center py-10">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-700"></div>
          <p class="mt-2 text-gray-600">Loading booking data...</p>
        </div>
      {:else}
        <BookingsTable
          {bookings}
          {searchTerm}
          {filterStatus}
          {filterMidwife}
          {filterDateRange}
        />
      {/if}
    </div>
  {/if}
</div>