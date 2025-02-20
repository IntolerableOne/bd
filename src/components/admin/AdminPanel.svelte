<script>
  import { onMount } from 'svelte';
  import AdminHeader from './AdminHeader.svelte';
  import AdminCalendar from './AdminCalendar.svelte';
  import BookingsTable from './BookingsTable.svelte';
  
  let isAuthenticated = false;
  let email = '';
  let password = '';
  let authError = '';

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
    bookings: false
  };
  let selectedView = 'week';
  let viewDates = [];
  let searchTerm = '';
  let filterStatus = 'all';
  let filterMidwife = 'all';
  let filterDateRange = 'all';

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
    console.log('Updated viewDates:', viewDates);
  }

  async function handleLogin() {
    authError = '';
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
        authError = data.error || 'Login failed';
      }
    } catch (error) {
      authError = 'Login failed. Please try again.';
    }
  }

  function handleLogout() {
    localStorage.removeItem('adminToken');
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
      const response = await fetch('/api/availability', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to load availability');
      slots = await response.json();
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  }

  async function loadBookings() {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/booking', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to load bookings');
      const data = await response.json();
      bookings = data.bookings;
      earnings = data.earnings;
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  }

  async function handleAddSlot(event) {
    const { day, timeSlot } = event.detail;
    try {
      const token = localStorage.getItem('adminToken');
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
      
      if (!response.ok) throw new Error('Failed to add slot');
      await loadAvailability();
    } catch (error) {
      console.error('Error adding slot:', error);
    }
  }

  async function handleRemoveSlot(event) {
    const slot = event.detail;
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/availability/${slot.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to remove slot');
      await loadAvailability();
    } catch (error) {
      console.error('Error removing slot:', error);
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

  $: viewDates = getWeekDates(currentDate);

  onMount(async () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      isAuthenticated = true;
      await loadData();
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
        <button
          on:click={handleLogout}
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
          Logout
        </button>
      </div>

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

        <!-- Calendar Grid -->
        <!-- Calendar Headers -->
        <div class="grid grid-cols-7 gap-2 mb-2">
          {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
            <div class="text-center font-semibold py-2">{day}</div>
          {/each}
        </div>

        <AdminCalendar
        {selectedMidwife}
        {currentDate}
        {slots}
        {viewDates}
        on:addSlot={handleAddSlot}
        on:removeSlot={handleRemoveSlot}
      />
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
      <BookingsTable
        {bookings}
        {searchTerm}
        {filterMidwife}
        {filterDateRange}
      />
    </div>
  {/if}
</div>