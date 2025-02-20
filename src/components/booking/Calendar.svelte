<script>
  import { onMount } from 'svelte';
  
  export let selectedSlot = null;
  let currentDate = new Date();
  let isMobile = false;
  let availableSlots = [];
  let loading = false;
  let error = null;
  let initialized = false;

  function getWeekDays(startDate) {
    const days = [];
    const currentDay = new Date(startDate);
    currentDay.setDate(currentDay.getDate() - currentDay.getDay());
    currentDay.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentDay);
      days.push(day);
      currentDay.setDate(currentDay.getDate() + 1);
    }
    return days;
  }

  async function loadAvailability() {
    if (loading) return;
    
    loading = true;
    error = null;
    availableSlots = []; // Clear existing slots
    
    try {
      const weekDays = getWeekDays(currentDate);
      const startDate = weekDays[0];
      const endDate = weekDays[6];

      const response = await fetch(
        `/api/available-slots?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);

      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received');
      }

      // Process slots immediately after receiving them
      availableSlots = data.map(slot => ({
        id: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime
      }));

      console.log('Processed slots:', availableSlots);
      
      initialized = true;
    } catch (e) {
      console.error('Error loading slots:', e);
      error = 'Failed to load available slots. Please try again.';
      availableSlots = [];
    } finally {
      loading = false;
    }
  }

  function getAvailableSlotsForDay(day) {
    // Convert day to date-only string for comparison
    const dayString = day.toISOString().split('T')[0];
    
    return availableSlots.filter(slot => {
      const slotString = new Date(slot.date).toISOString().split('T')[0];
      return dayString === slotString;
    });
  }

  function handleResize() {
    isMobile = window.innerWidth < 768;
  }

  function handleSlotSelection(slot) {
    selectedSlot = selectedSlot?.id === slot.id ? null : slot;
  }

  function getStartOfWeek(date) {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() - date.getDay());
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  }

  async function switchWeek(direction) {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    currentDate = newDate;
    
    console.log('Switching to week:', {
      newDate: newDate.toISOString(),
      direction
    });
    
    await loadAvailability();
  }

  $: canGoPrevious = getStartOfWeek(currentDate) >= getStartOfWeek(new Date());
  $: canGoNext = getStartOfWeek(currentDate) < getStartOfWeek(new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000));
  $: weekDays = getWeekDays(currentDate);
  $: {
    if (availableSlots.length > 0) {
      console.log('Current state:', {
        currentDate: currentDate.toISOString(),
        weekDays: weekDays.map(d => d.toISOString()),
        availableSlots: availableSlots.map(s => ({
          date: s.date,
          startTime: s.startTime
        }))
      });
    }
  }

  onMount(async () => {
    handleResize();
    window.addEventListener('resize', handleResize);
    
    const today = new Date();
    if (getStartOfWeek(currentDate) < getStartOfWeek(today)) {
      currentDate = today;
    }
    
    await loadAvailability();

    return () => window.removeEventListener('resize', handleResize);
  });
</script>

<div>
  {#if loading && !initialized}
    <div class="flex justify-center items-center py-16">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
      <span class="block sm:inline">{error}</span>
      <button 
        class="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
        on:click={loadAvailability}>
        Try Again
      </button>
    </div>
  {:else}
    <div class="flex justify-between items-center mb-4">
      <button 
        class="p-2 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={() => switchWeek(-1)}
        disabled={!canGoPrevious}
        aria-label="Previous Week">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" 
          stroke={canGoPrevious ? "currentColor" : "#9CA3AF"} 
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h3 class="text-lg font-semibold">
        {weekDays[0].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - 
        {weekDays[6].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
      </h3>
      <button 
        class="p-2 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={() => switchWeek(1)}
        disabled={!canGoNext}
        aria-label="Next Week">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" 
          stroke={canGoNext ? "currentColor" : "#9CA3AF"} 
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {#each weekDays as day}
        {@const daySlots = getAvailableSlotsForDay(day)}
        {#if daySlots.length > 0}
          <div class="border rounded-lg p-4 bg-white shadow-sm">
            <h4 class="font-semibold mb-3 text-center">
              {day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </h4>
            <div class="space-y-2">
              {#each daySlots as slot}
                <button
                  class="w-full p-3 text-left rounded-lg transition-colors {selectedSlot?.id === slot.id ? 'bg-green-700 text-white' : 'bg-green-50 hover:bg-green-100 border border-green-200'}"
                  on:click={() => handleSlotSelection(slot)}>
                  <div class="text-sm font-medium">{slot.startTime}</div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    {#if loading && initialized}
      <div class="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-green-700"></div>
        <span class="text-sm">Updating...</span>
      </div>
    {/if}
  {/if}
</div>