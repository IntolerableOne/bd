<!-- src/components/booking/Calendar.svelte -->
<script>
  import { onMount, tick } from 'svelte';
  
  export let selectedSlot = null;
  export let isLoading = true;

  let currentDate = new Date();
  let isMobile = false;
  let availableSlots = [];
  let loading = false;  // Changed to false initially
  let error = null;
  let initialized = false;
  let weekDays = [];

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
    // Remove the early return on loading
    loading = true;
    isLoading = true;
    error = null;
    availableSlots = [];

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

  onMount(async () => {
    handleResize();
    window.addEventListener('resize', handleResize);
    await loadAvailability();
    
    // Set up periodic refresh of availability
    const refreshInterval = setInterval(loadAvailability, 30000); // Refresh every 30 seconds
    
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
                  <div class="text-sm font-medium">{slot.startTime}</div>
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
        <div class="border rounded-lg p-4 bg-white min-h-[150px]">
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
                <div class="text-sm font-medium">{slot.startTime}</div>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if !loading && !error && availableSlots.length === 0}
  <div class="text-center py-8 text-gray-600">
    No available slots for this week. Please try another week.
  </div>
{/if}