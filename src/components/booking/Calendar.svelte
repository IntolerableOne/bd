<!-- src/components/booking/Calendar.svelte -->
<script>
  import { onMount, tick } from 'svelte';
  
  export let selectedSlot = null;
  export let isLoading = true;

  let currentDate = new Date();
  let isMobile = false;
  let availableSlots = [];
  let loading = false;
  let error = null;
  let initialized = false;
  let weekDays = [];
  let retryCount = 0;
  const maxRetries = 3;

  function getWeekDays(startDate) {
    const days = [];
    const currentDay = new Date(startDate);
    currentDay.setDate(currentDay.getDate() - currentDay.getDay()); // Start from Sunday
    currentDay.setHours(0, 0, 0, 0); // Reset time
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentDay);
      days.push(day);
      currentDay.setDate(currentDay.getDate() + 1);
    }
    return days;
  }

  function getDaySlotsForDate(day) {
    return availableSlots.filter(slot => {
      const slotDate = new Date(slot.date);
      return slotDate.getFullYear() === day.getFullYear() &&
             slotDate.getMonth() === day.getMonth() &&
             slotDate.getDate() === day.getDate();
    });
  }

  async function loadAvailability() {
    loading = true;
    isLoading = true;
    error = null;
    
    console.log('Loading availability...'); // Debug log
    
    try {
      weekDays = getWeekDays(currentDate);
      const startDate = weekDays[0];
      const endDate = weekDays[6];

      // Set the time to midnight for consistent date handling
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      const formattedStartDate = startDate.toISOString();
      const formattedEndDate = endDate.toISOString();

      const response = await fetch(
        `/api/available-slots?startDate=${formattedStartDate}&endDate=${formattedEndDate}`,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (!response.ok) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retry attempt ${retryCount}/${maxRetries}...`);
          setTimeout(() => loadAvailability(), 1000); // Retry after 1 second
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received data:', data); // Debug log
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from server');
      }
      
      // Parse dates in the response
      availableSlots = data.map(slot => ({
        ...slot,
        date: new Date(slot.date)
      }));
      
      initialized = true;
      retryCount = 0; // Reset retry counter on success
      await tick();
      
    } catch (e) {
      console.error('Error loading slots:', e);
      error = 'Failed to load available slots. Please try again.';
      availableSlots = [];
    } finally {
      loading = false;
      isLoading = false;
    }
  }

  function handleSlotSelection(slot) {
    selectedSlot = selectedSlot?.id === slot.id ? null : slot;
  }

  function previousWeek() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    currentDate = newDate;
    loadAvailability();
  }

  function nextWeek() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    currentDate = newDate;
    loadAvailability();
  }

  function handleResize() {
    isMobile = window.innerWidth < 768;
  }

  function formatTime(timeString) {
    // Convert 24-hour format to 12-hour format with AM/PM
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  onMount(async () => {
    handleResize();
    window.addEventListener('resize', handleResize);
    await loadAvailability();
    
    // Set up periodic refresh of availability
    const refreshInterval = setInterval(loadAvailability, 60000); // Refresh every minute
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(refreshInterval);
    };
  });

  $: weekDays = getWeekDays(currentDate);
</script>

<!-- Error Message -->
{#if error}
  <div class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
    {error}
    <button 
      class="underline ml-2"
      on:click={() => {
        error = null;
        loadAvailability();
      }}>
      Try again
    </button>
  </div>
{/if}

<!-- Mobile View -->
<div class="block md:hidden">
  <div class="flex justify-between items-center mb-4">
    <button 
      on:click={previousWeek}
      class="p-2 rounded-lg bg-green-200 hover:bg-green-100">
      Previous Week
    </button>
    <h3 class="text-lg font-semibold">
      {weekDays[0].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - 
      {weekDays[6].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
    </h3>
    <button 
      on:click={nextWeek}
      class="p-2 rounded-lg bg-green-200 hover:bg-green-100">
      Next Week
    </button>
  </div>

  {#if loading && !initialized}
    <div class="flex justify-center items-center py-16">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
    </div>
  {:else}
    <div class="space-y-4">
      {#each weekDays as day}
        {@const daySlots = getDaySlotsForDate(day)}
        {#if daySlots.length > 0}
          <div class="border rounded-lg p-4 bg-white">
            <h4 class="font-semibold mb-3">
              {day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </h4>
            <div class="space-y-2">
              {#each daySlots as slot}
                <button
                  class="w-full p-3 text-left rounded-lg transition-colors
                    {selectedSlot?.id === slot.id ? 
                      'bg-green-700 text-white' : 
                      'bg-green-50 hover:bg-green-100 border border-green-200'}"
                  on:click={() => handleSlotSelection(slot)}>
                  <div class="text-sm font-medium">{formatTime(slot.startTime)}</div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<!-- Desktop View -->
<div class="hidden md:block">
  <div class="flex justify-between items-center mb-4">
    <button 
      on:click={previousWeek}
      class="p-2 rounded-lg bg-green-200 hover:bg-green-100">
      Previous Week
    </button>
    <h3 class="text-lg font-semibold">
      {weekDays[0].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - 
      {weekDays[6].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
    </h3>
    <button 
      on:click={nextWeek}
      class="p-2 rounded-lg bg-green-200 hover:bg-green-100">
      Next Week
    </button>
  </div>

  {#if loading && !initialized}
    <div class="flex justify-center items-center py-16">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
    </div>
  {:else}
    <div class="grid grid-cols-7 gap-4">
      {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
        <div class="text-center font-semibold">{day}</div>
      {/each}

      {#each weekDays as day}
        {@const daySlots = getDaySlotsForDate(day)}
        <div class="border rounded-lg p-4 bg-white min-h-[150px] max-h-[400px] overflow-y-auto">
          <h4 class="font-semibold mb-3 text-center">
            {day.getDate()}
          </h4>
          <div class="space-y-2">
            {#each daySlots as slot}
              <button
                class="w-full p-2 text-left rounded-lg text-sm transition-colors
                  {selectedSlot?.id === slot.id ? 
                    'bg-green-700 text-white' : 
                    'bg-green-50 hover:bg-green-100 border border-green-200'}"
                on:click={() => handleSlotSelection(slot)}>
                <div class="text-sm font-medium">{formatTime(slot.startTime)}</div>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if !loading && !error && availableSlots.length === 0}
  <div class="text-center py-8 bg-yellow-50 border border-yellow-200 rounded-lg">
    <p class="text-yellow-700 mb-2">No available slots found for this week.</p>
    <p class="text-yellow-600">
      This could be due to:
    </p>
    <ul class="text-yellow-600 list-disc list-inside mt-2 mb-4">
      <li>All slots are booked</li>
      <li>No slots have been created yet</li>
      <li>A temporary connection issue with our system</li>
    </ul>
    <p class="text-yellow-700">
      Please try another week or <a href="/contact" class="underline font-medium">contact us</a> for assistance.
    </p>
  </div>
{/if}