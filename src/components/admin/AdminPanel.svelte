<script>
  import { onMount } from 'svelte';
  import AdminHeader from './AdminHeader.svelte';
  import AdminCalendar from './AdminCalendar.svelte';
  import BookingsTable from './BookingsTable.svelte';

  let isAuthenticated = false;
  let email = '';
  let password = '';
  let authError = '';
  let dataLoadError = ''; // For displaying errors related to loading slots/bookings

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
  let viewDates = []; // This will be calculated based on currentDate
  let searchTerm = '';
  // let filterStatus = 'all'; // filterStatus was defined but not used in BookingsTable props
  let filterMidwife = 'all';
  let filterDateRange = 'all'; // Corresponds to 'This Week', 'This Month' etc.

  function getWeekDates(date) {
    const dates = [];
    const start = new Date(date);
    // Adjust to start the week on Monday (day 1) instead of Sunday (day 0)
    const dayOfWeek = start.getDay(); // 0 (Sun) to 6 (Sat)
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // if Sunday, go back 6 days, else go back to Monday
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const newDate = new Date(start);
      newDate.setDate(start.getDate() + i);
      dates.push(newDate);
    }
    return dates;
  }

  // Initialize viewDates reactively
  $: viewDates = getWeekDates(currentDate);

  async function handleLogin() {
    authError = '';
    dataLoadError = ''; // Clear previous data load errors
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
        email = ''; // Clear form
        password = ''; // Clear form
        await loadData(); // Load data after successful login
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
    // Clear sensitive data
    slots = [];
    bookings = [];
    earnings = { monthly: {}, yearly: 0 };
    authError = '';
    dataLoadError = '';
  }

  async function loadData() {
    if (!isAuthenticated) return; // Should not happen if called correctly

    loading.slots = true;
    loading.bookings = true;
    dataLoadError = ''; // Clear previous errors

    try {
      // Fetch in parallel
      await Promise.all([
        loadAvailability(),
        loadBookings()
      ]);
    } catch (error) {
      // Errors from loadAvailability/loadBookings will set dataLoadError
      console.error('Error loading admin data:', error);
      // dataLoadError might already be set by individual functions
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
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load availability (status: ${response.status})`);
      }
      slots = await response.json();
    } catch (error) {
      console.error('Error loading availability:', error);
      dataLoadError = error.message || 'Failed to load availability slots.';
      slots = []; // Reset or keep stale data? Resetting is safer.
      // throw error; // Re-throw to be caught by loadData if needed
    }
  }

  async function loadBookings() {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) throw new Error('Admin token not found.');

      const response = await fetch('/api/booking', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load bookings (status: ${response.status})`);
      }
      const data = await response.json();
      bookings = data.bookings;
      earnings = data.earnings;
    } catch (error) {
      console.error('Error loading bookings:', error);
      dataLoadError = error.message || 'Failed to load booking data.';
      bookings = []; // Reset
      earnings = { monthly: {}, yearly: 0 }; // Reset
      // throw error; // Re-throw
    }
  }

  async function handleAddSlot(event) {
    const { day, timeSlot } = event.detail;
    dataLoadError = ''; // Clear previous errors
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
          dataLoadError = "Authentication error. Please log in again.";
          return;
      }
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: day.toISOString(), // Send as ISO string
          startTime: timeSlot.start,
          endTime: timeSlot.end,
          midwife: selectedMidwife
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to add slot (status: ${response.status})`);
      }
      await loadAvailability(); // Refresh slots list
    } catch (error) {
      console.error('Error adding slot:', error);
      dataLoadError = error.message || 'Error adding slot. Please try again.';
    }
  }

  async function handleRemoveSlot(event) {
    const slotToRemove = event.detail; // slotToRemove should have an ID
    if (!slotToRemove || !slotToRemove.id) {
        dataLoadError = "Cannot remove slot: Slot ID is missing.";
        return;
    }
    dataLoadError = ''; // Clear previous errors
    try {
      const token = localStorage.getItem('adminToken');
       if (!token) {
          dataLoadError = "Authentication error. Please log in again.";
          return;
      }
      const response = await fetch(`/api/availability/${slotToRemove.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove slot (status: ${response.status})`);
      }
      await loadAvailability(); // Refresh slots list
    } catch (error) {
      console.error('Error removing slot:', error);
      dataLoadError = error.message || 'Error removing slot. Please try again.';
    }
  }

  function previousPeriod() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7); // Go back 7 days
    currentDate = newDate;
    // viewDates will update reactively
  }

  function nextPeriod() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7); // Go forward 7 days
    currentDate = newDate;
    // viewDates will update reactively
  }


  onMount(async () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      // Potentially verify token validity here before setting isAuthenticated
      isAuthenticated = true; // Assuming token presence means authenticated for now
      await loadData();
    }
  });

  // For BookingsTable filtering
  let filteredBookingsForTable = [];
  $: {
    const lowerSearchTerm = searchTerm.toLowerCase();
    filteredBookingsForTable = bookings.filter(booking => {
        const matchesSearch = !searchTerm ||
            booking.name.toLowerCase().includes(lowerSearchTerm) ||
            booking.email.toLowerCase().includes(lowerSearchTerm);

        const matchesMidwife = filterMidwife === 'all' ||
            booking.availability?.midwife === filterMidwife;

        let matchesDate = true;
        if (filterDateRange !== 'all' && booking.availability?.date) {
            const bookingDate = new Date(booking.availability.date);
            const now = new Date();
            now.setHours(0,0,0,0); // Start of today

            switch (filterDateRange) {
                case 'today':
                    matchesDate = bookingDate.toDateString() === now.toDateString();
                    break;
                case 'week': // This calendar week (Mon-Sun)
                    const currentWeekStart = getWeekDates(now)[0];
                    const currentWeekEnd = new Date(currentWeekStart);
                    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
                    currentWeekEnd.setHours(23,59,59,999);
                    matchesDate = bookingDate >= currentWeekStart && bookingDate <= currentWeekEnd;
                    break;
                case 'month': // This calendar month
                    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    currentMonthEnd.setHours(23,59,59,999);
                    matchesDate = bookingDate >= currentMonthStart && bookingDate <= currentMonthEnd;
                    break;
            }
        }
        return matchesSearch && matchesMidwife && matchesDate;
    }).sort((a, b) => new Date(b.availability?.date).getTime() - new Date(a.availability?.date).getTime());
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
        <button
          on:click={handleLogout}
          class="px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
          Logout
        </button>
      </div>

      {#if dataLoadError}
        <div class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg border border-red-300" role="alert">
          <span class="font-medium">Error:</span> {dataLoadError} Please try refreshing or contact support if the issue persists.
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
              {currentDate} {slots}
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
