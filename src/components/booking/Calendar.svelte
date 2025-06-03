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

  function formatTimeSlot(startTime) {
    // Convert 24-hour format to 12-hour format for better readability
    const [hours, minutes] = startTime.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
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
      class="underline ml-2 hover:text-red-800"
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
      class="px-4 py-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 font-medium transition-colors">
      ← Previous
    </button>
    <h3 class="text-lg font-semibold text-center">
      {weekDays[0].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - 
      {weekDays[6].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
    </h3>
    <button 
      on:click={nextWeek}
      class="px-4 py-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 font-medium transition-colors">
      Next →
    </button>
  </div>

  {#if loading && !initialized}
    <div class="flex justify-center items-center py-16">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      <p class="ml-3 text-gray-600">Loading available appointments...</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each weekDays as day}
        {@const daySlots = getDaySlotsForDate(day)}
        {#if daySlots.length > 0}
          <div class="border rounded-lg p-4 bg-white shadow-sm">
            <h4 class="font-semibold mb-3 text-gray-800">
              {day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
            </h4>
            <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {#each daySlots as slot}
                <button
                  class="p-3 text-left rounded-lg text-sm transition-all duration-200 border-2
                    {selectedSlot?.id === slot.id ? 
                      'bg-green-700 text-white border-green-700 shadow-md' : 
                      'bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-300 text-green-800'}"
                  on:click={() => handleSlotSelection(slot)}>
                  <div class="font-medium">{formatTimeSlot(slot.startTime)}</div>
                  <div class="text-xs opacity-75 capitalize">{slot.midwife}</div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
      
      {#if !loading && availableSlots.length === 0}
        <div class="text-center py-8 text-gray-600 bg-gray-50 rounded-lg">
          <p class="text-lg font-medium mb-2">No appointments available this week</p>
          <p class="text-sm">Please try selecting another week</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Desktop View -->
<div class="hidden md:block">
  <div class="flex justify-between items-center mb-6">
    <button 
      on:click={previousWeek}
      class="px-6 py-3 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 font-medium transition-colors flex items-center gap-2">
      <span>←</span> Previous Week
    </button>
    <h3 class="text-xl font-semibold text-gray-800">
      {weekDays[0].toLocaleDateString('en-GB', { month: 'long', day: 'numeric' })} - 
      {weekDays[6].toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' })}
    </h3>
    <button 
      on:click={nextWeek}
      class="px-6 py-3 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 font-medium transition-colors flex items-center gap-2">
      Next Week <span>→</span>
    </button>
  </div>

  {#if loading && !initialized}
    <div class="flex justify-center items-center py-16">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      <p class="ml-3 text-gray-600">Loading available appointments...</p>
    </div>
  {:else}
    <div class="grid grid-cols-7 gap-4">
      {#each ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as dayName, index}
        <div class="text-center font-semibold text-gray-700 py-2">
          <div class="text-sm">{dayName}</div>
          <div class="text-lg">{weekDays[index]?.getDate()}</div>
        </div>
      {/each}

      {#each weekDays as day}
        {@const daySlots = getDaySlotsForDate(day)}
        <div class="border rounded-lg p-3 bg-white min-h-[300px] shadow-sm">
          <div class="space-y-2 max-h-72 overflow-y-auto">
            {#each daySlots as slot}
              <button
                class="w-full p-2 text-left rounded-lg text-sm transition-all duration-200 border
                  {selectedSlot?.id === slot.id ? 
                    'bg-green-700 text-white border-green-700 shadow-md' : 
                    'bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-300 text-green-800'}"
                on:click={() => handleSlotSelection(slot)}>
                <div class="font-medium">{formatTimeSlot(slot.startTime)}</div>
                <div class="text-xs opacity-75 capitalize">{slot.midwife}</div>
              </button>
            {/each}
            
            {#if daySlots.length === 0}
              <div class="text-center py-8 text-gray-400">
                <div class="text-xs">No appointments available</div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if selectedSlot}
  <div class="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
    <h4 class="font-semibold text-green-800 mb-2">Selected Appointment</h4>
    <div class="text-sm text-green-700">
      <p><strong>Date:</strong> {selectedSlot.date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p><strong>Time:</strong> {formatTimeSlot(selectedSlot.startTime)}</p>
      <p><strong>Midwife:</strong> <span class="capitalize">{selectedSlot.midwife}</span></p>
    </div>
  </div>
{/if}