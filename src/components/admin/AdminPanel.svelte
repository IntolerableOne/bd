<script>
  import { onMount } from 'svelte';
  import Card from '../ui/Card.svelte';
  
  // Authentication state
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
  let isMobile = false;
  
  // Calendar state
  $: weekDays = getWeekDays(currentDate);
  const timeSlots = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '13:00', end: '14:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' }
  ];

  const ADMIN_EMAIL = 'admin@birthdebrief.com';
  const ADMIN_PASSWORD = 'adminpass123';
  
  function handleLogin() {
    authError = '';
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      isAuthenticated = true;
      email = '';
      password = '';
      loadAvailability();
      loadBookings();
    } else {
      authError = 'Invalid credentials';
    }
  }

  function handleLogout() {
    isAuthenticated = false;
    slots = [];
    bookings = [];
    earnings = {
      monthly: {},
      yearly: 0
    };
  }
  
  async function loadAvailability() {
    try {
      const response = await fetch('/api/availability');
      if (!response.ok) throw new Error('Failed to load availability');
      const data = await response.json();
      slots = data;
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  }

  async function loadBookings() {
    try {
      const response = await fetch('/api/booking');
      if (!response.ok) throw new Error('Failed to load bookings');
      const data = await response.json();
      bookings = data.bookings;
      earnings = data.earnings;
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  }

  async function addSlot(date, timeSlot) {
    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: date.toISOString(),
          startTime: timeSlot.start,
          endTime: timeSlot.end,
          midwife: selectedMidwife
        })
      });
      
      if (!response.ok) throw new Error('Failed to add slot');
      await loadAvailability(); // Reload slots after adding
    } catch (error) {
      console.error('Error adding slot:', error);
    }
  }

  async function removeSlot(slotId) {
    try {
      const response = await fetch(`/api/availability/${slotId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to remove slot');
      await loadAvailability(); // Reload slots after removing
    } catch (error) {
      console.error('Error removing slot:', error);
    }
  }

  function getWeekDays(startDate) {
    const days = [];
    const currentDay = new Date(startDate);
    currentDay.setDate(currentDay.getDate() - currentDay.getDay());
    
    for (let i = 0; i < 7; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    return days;
  }

  function isSlotTaken(date, timeSlot) {
    return slots.some(slot => {
      const slotDate = new Date(slot.date);
      return slotDate.toDateString() === date.toDateString() && 
             slot.startTime === timeSlot.start;
    });
  }

  function previousWeek() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    currentDate = newDate;
  }

  function nextWeek() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    currentDate = newDate;
  }

  function previousDay() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    currentDate = newDate;
  }

  function nextDay() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    currentDate = newDate;
  }

  function handleResize() {
    isMobile = window.innerWidth < 768;
  }

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });
</script>

<div class="w-full max-w-6xl mx-auto p-4">
  {#if !isAuthenticated}
    <Card className="max-w-md mx-auto">
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
    </Card>
  {:else}
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Admin Panel</h1>
      <button
        on:click={handleLogout}
        class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
        Logout
      </button>
    </div>

    <Card className="mb-6" title="Availability Calendar">
      <div class="flex gap-4 mb-4">
        <button 
          class="flex-1 px-4 py-2 rounded-lg transition-colors {selectedMidwife === 'clare' ? 'bg-green-700 text-white' : 'border-2 border-green-700 text-green-700'}"
          on:click={() => selectedMidwife = 'clare'}>
          Clare
        </button>
        <button 
          class="flex-1 px-4 py-2 rounded-lg transition-colors {selectedMidwife === 'natalie' ? 'bg-green-700 text-white' : 'border-2 border-green-700 text-green-700'}"
          on:click={() => selectedMidwife = 'natalie'}>
          Natalie
        </button>
      </div>

      <!-- Mobile View -->
      {#if isMobile}
        <div class="flex justify-between items-center mb-4">
          <button 
            class="px-4 py-2 bg-green-700 text-white rounded-lg"
            on:click={previousDay}>
            Previous Day
          </button>
          <h3 class="text-lg font-semibold">
            {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </h3>
          <button 
            class="px-4 py-2 bg-green-700 text-white rounded-lg"
            on:click={nextDay}>
            Next Day
          </button>
        </div>
        
        <div class="space-y-2">
          {#each timeSlots as timeSlot}
            <button
              class="w-full p-4 rounded-lg transition-colors flex justify-between items-center {isSlotTaken(currentDate, timeSlot) ? 'bg-green-700 text-white' : 'border border-green-700 hover:bg-green-100'}"
              on:click={() => addSlot(currentDate, timeSlot)}>
              <span>{timeSlot.start}</span>
              <span>{isSlotTaken(currentDate, timeSlot) ? '✓' : '+'}</span>
            </button>
          {/each}
        </div>

      <!-- Desktop View -->
      {:else}
        <div class="flex justify-between items-center mb-4">
          <button 
            class="px-4 py-2 bg-green-700 text-white rounded-lg"
            on:click={previousWeek}>
            Previous Week
          </button>
          <h3 class="text-lg font-semibold">
            Week of {weekDays[0].toLocaleDateString()}
          </h3>
          <button 
            class="px-4 py-2 bg-green-700 text-white rounded-lg"
            on:click={nextWeek}>
            Next Week
          </button>
        </div>
        
        <div class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr>
                <th class="p-2 border text-left">Time</th>
                {#each weekDays as day}
                  <th class="p-2 border text-center">
                    {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each timeSlots as timeSlot}
                <tr>
                  <td class="p-2 border">
                    {timeSlot.start}
                  </td>
                  {#each weekDays as day}
                    <td class="p-2 border text-center">
                      <button
                        class="w-full py-2 rounded-lg transition-colors {isSlotTaken(day, timeSlot) ? 'bg-green-700 text-white' : 'hover:bg-green-100'}"
                        on:click={() => addSlot(day, timeSlot)}>
                        {isSlotTaken(day, timeSlot) ? '✓' : '+'}
                      </button>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>

    <Card title="Added Slots">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {#each slots as slot (slot.id)}
          <div class="flex items-center justify-between p-2 border rounded-md">
            <span>
              {new Date(slot.date).toLocaleDateString()} - {slot.startTime}
              ({slot.midwife})
            </span>
            <button
              class="text-red-500 hover:text-red-700 p-1"
              on:click={() => removeSlot(slot.id)}
              aria-label="Remove Slot">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        {/each}
      </div>
    </Card>

    <Card title="Bookings Overview" className="mt-6">
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="p-4 bg-green-50 rounded-lg">
            <h3 class="font-semibold text-lg mb-2">Total Earnings</h3>
            <p class="text-2xl font-bold">£{earnings.yearly}</p>
          </div>
          <div class="p-4 bg-green-50 rounded-lg">
            <h3 class="font-semibold text-lg mb-2">Total Bookings</h3>
            <p class="text-2xl font-bold">{bookings.length}</p>
          </div>
        </div>

        <div class="mt-6">
          <h3 class="font-semibold text-lg mb-4">Recent Bookings</h3>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr>
                  <th class="p-2 border text-left">Date</th>
                  <th class="p-2 border text-left">Client</th>
                  <th class="p-2 border text-left">Midwife</th>
                  <th class="p-2 border text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {#each bookings.slice(0, 5) as booking}
                  <tr>
                    <td class="p-2 border">
                      {new Date(booking.availability.date).toLocaleDateString()}
                    </td>
                    <td class="p-2 border">{booking.clientName}</td>
                    <td class="p-2 border">{booking.availability.midwife}</td>
                    <td class="p-2 border">
                      <span class="px-2 py-1 text-sm rounded-full {booking.paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        {booking.paid ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  {/if}
</div>

<style>
  table {
    border-spacing: 0;
  }
  td, th {
    border: 1px solid #e5e7eb;
  }
</style>