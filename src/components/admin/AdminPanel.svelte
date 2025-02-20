<script>
  import { onMount } from 'svelte';
  
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
  let selectedView = 'week'; // 'week' or 'month'
  let viewDates = [];

  // Calendar state
  const timeSlots = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '13:00', end: '14:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' }
  ];

  // Search and filter state
  let searchTerm = '';
  let filterStatus = 'all';
  let filterMidwife = 'all';
  let filterDateRange = 'all';

  function getDateRange(view, baseDate) {
    const dates = [];
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);

    if (view === 'week') {
      // Set to start of week (Sunday)
      start.setDate(start.getDate() - start.getDay());
      
      // Get 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date);
      }
    } else {
      // Set to start of month
      start.setDate(1);
      
      // Get all days in the month
      const month = start.getMonth();
      const year = start.getFullYear();
      let currentDate = new Date(year, month, 1);
      
      while (currentDate.getMonth() === month) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return dates;
  }

  function isSlotTaken(day, timeSlot) {
    return slots.some(slot => {
      const slotDate = new Date(slot.date);
      return slotDate.toDateString() === day.toDateString() && 
             slot.startTime === timeSlot.start &&
             slot.midwife === selectedMidwife;
    });
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
        await loadAvailability();
        await loadBookings();
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

  async function loadAvailability() {
    loading.slots = true;
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
    } finally {
      loading.slots = false;
    }
  }

  async function loadBookings() {
    loading.bookings = true;
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
    } finally {
      loading.bookings = false;
    }
  }

  async function addSlot(date, slot) {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date,
          startTime: slot.start,
          endTime: slot.end,
          midwife: selectedMidwife
        })
      });
      
      if (!response.ok) throw new Error('Failed to add slot');
      await loadAvailability();
    } catch (error) {
      console.error('Error adding slot:', error);
    }
  }

  async function removeSlot(slotId) {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/availability/${slotId}`, {
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
    if (selectedView === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    currentDate = newDate;
    viewDates = getDateRange(selectedView, currentDate);
  }

  function nextPeriod() {
    const newDate = new Date(currentDate);
    if (selectedView === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    currentDate = newDate;
    viewDates = getDateRange(selectedView, currentDate);
  }

  // Reactive statements
  $: filteredBookings = bookings
    .filter(booking => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        booking.name.toLowerCase().includes(searchLower) ||
        booking.email.toLowerCase().includes(searchLower);

      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'paid' && booking.paid) ||
        (filterStatus === 'pending' && !booking.paid);

      const matchesMidwife = filterMidwife === 'all' || 
        booking.availability.midwife === filterMidwife;

      let matchesDate = true;
      if (filterDateRange !== 'all') {
        const bookingDate = new Date(booking.availability.date);
        const now = new Date();
        switch (filterDateRange) {
          case 'today':
            matchesDate = bookingDate.toDateString() === now.toDateString();
            break;
          case 'week':
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            matchesDate = bookingDate >= weekAgo;
            break;
          case 'month':
            const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
            matchesDate = bookingDate >= monthAgo;
            break;
        }
      }

      return matchesSearch && matchesStatus && matchesMidwife && matchesDate;
    })
    .sort((a, b) => new Date(b.availability.date) - new Date(a.availability.date));

  $: {
    viewDates = getDateRange(selectedView, currentDate);
  }

  onMount(async () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      isAuthenticated = true;
      await loadAvailability();
      await loadBookings();
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
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-lg font-semibold mb-2">Total Earnings</h3>
          <p class="text-3xl font-bold">£{(earnings.yearly / 100).toFixed(2)}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-lg font-semibold mb-2">Total Bookings</h3>
          <p class="text-3xl font-bold">{bookings.length}</p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-lg font-semibold mb-2">Available Slots</h3>
          <p class="text-3xl font-bold">{slots.filter(s => !s.booking).length}</p>
        </div>
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
              bind:value={filterStatus}
              class="px-4 py-2 border rounded-md">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
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

      <!-- Availability Calendar -->
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

<!-- View Toggle -->
<div class="flex gap-4 mb-6">
  <button 
    class="flex-1 px-4 py-2 rounded-lg transition-colors {selectedView === 'week' ? 'bg-green-700 text-white' : 'border-2 border-green-700 text-green-700'}"
    on:click={() => selectedView = 'week'}>
    Week View
  </button>
  <button 
    class="flex-1 px-4 py-2 rounded-lg transition-colors {selectedView === 'month' ? 'bg-green-700 text-white' : 'border-2 border-green-700 text-green-700'}"
    on:click={() => selectedView = 'month'}>
    Month View
  </button>
</div>

<!-- Navigation -->
<div class="flex justify-between items-center mb-6">
  <button 
    on:click={previousPeriod}
    class="px-4 py-2 rounded-lg border border-green-700 text-green-700 hover:bg-green-50">
    Previous {selectedView === 'week' ? 'Week' : 'Month'}
  </button>
  <h3 class="text-lg font-semibold">
    {#if selectedView === 'week'}
      {viewDates[0]?.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - 
      {viewDates[6]?.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
    {:else}
      {currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
    {/if}
  </h3>
  <button 
    on:click={nextPeriod}
    class="px-4 py-2 rounded-lg border border-green-700 text-green-700 hover:bg-green-50">
    Next {selectedView === 'week' ? 'Week' : 'Month'}
  </button>
</div>

<!-- Calendar Grid -->
<div class="grid grid-cols-7 gap-2">
  <!-- Day labels -->
  {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
    <div class="text-center font-semibold py-2">{day}</div>
  {/each}
  
  <!-- Calendar days -->
  {#each viewDates as day}
    <div class="border rounded-lg p-2 min-h-[120px] {day.getMonth() !== currentDate.getMonth() ? 'opacity-50' : ''}">
      <h4 class="text-center font-semibold mb-2">
        {day.getDate()}
      </h4>
      <div class="space-y-1">
        {#each timeSlots as timeSlot}
          {#if !isSlotTaken(day, timeSlot)}
            <button
              class="w-full p-1 text-left rounded text-sm transition-colors hover:bg-green-100 border border-green-200"
              on:click={() => addSlot(day, timeSlot)}>
              <div class="text-xs font-medium">{timeSlot.start}</div>
            </button>
          {/if}
        {/each}
      </div>
    </div>
  {/each}
</div>
</div>

<!-- Booked Slots -->
<div class="bg-white p-6 rounded-lg shadow">
<h2 class="text-xl font-bold mb-4">Current Slots</h2>
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {#each slots as slot (slot.id)}
    <div class="flex items-center justify-between p-3 border rounded-lg {slot.booking ? 'bg-gray-50' : 'bg-white'}">
      <div>
        <div class="font-medium">{new Date(slot.date).toLocaleDateString('en-GB')} - {slot.startTime}</div>
        <div class="text-sm text-gray-600">{slot.midwife}</div>
        {#if slot.booking}
          <div class="text-xs text-gray-500 mt-1">Booked by: {slot.booking.name}</div>
        {/if}
      </div>
      {#if !slot.booking}
        <button
          class="text-red-500 hover:text-red-700 p-2"
          on:click={() => removeSlot(slot.id)}
          aria-label="Remove Slot">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      {/if}
    </div>
  {/each}
</div>
</div>
<!-- Bookings Table -->
<div class="bg-white p-6 rounded-lg shadow overflow-hidden">
  <h2 class="text-xl font-bold mb-4">Bookings</h2>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead>
        <tr class="bg-gray-50">
          <th class="px-4 py-2 text-left">Date</th>
          <th class="px-4 py-2 text-left">Time</th>
          <th class="px-4 py-2 text-left">Client</th>
          <th class="px-4 py-2 text-left">Email</th>
          <th class="px-4 py-2 text-left">Midwife</th>
          <th class="px-4 py-2 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredBookings as booking (booking.id)}
          <tr class="border-t hover:bg-gray-50">
            <td class="px-4 py-2">
              {new Date(booking.availability.date).toLocaleDateString('en-GB')}
            </td>
            <td class="px-4 py-2">{booking.availability.startTime}</td>
            <td class="px-4 py-2">{booking.name}</td>
            <td class="px-4 py-2">{booking.email}</td>
            <td class="px-4 py-2">{booking.availability.midwife}</td>
            <td class="px-4 py-2">
              <span 
                class="px-2 py-1 text-sm rounded-full {booking.paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                {booking.paid ? 'Paid' : 'Pending'}
              </span>
            </td>
          </tr>
        {/each}
        {#if filteredBookings.length === 0}
          <tr>
            <td colspan="6" class="px-4 py-8 text-center text-gray-500">
              No bookings found matching your filters
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
</div>
{/if}
</div>