<script>
  import { onMount } from 'svelte';
  
  export let selectedSlot = null;
  let currentDate = new Date();
  let isMobile = false;
  let availableSlots = [];
  let loading = false;
  let error = null;
  
  // Debug function to log date comparisons
  function logDateComparison(date1, date2, context) {
    console.log(`${context}:`, {
      date1: date1.toISOString(),
      date2: date2.toISOString(),
      date1String: date1.toDateString(),
      date2String: date2.toDateString(),
      matches: date1.toDateString() === date2.toDateString()
    });
  }

  function getWeekDays(startDate) {
    console.log('Getting week days for:', startDate);
    const days = [];
    const currentDay = new Date(startDate);
    currentDay.setDate(currentDay.getDate() - currentDay.getDay());
    
    for (let i = 0; i < 7; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    console.log('Week days:', days.map(d => d.toDateString()));
    return days;
  }

  async function loadAvailability() {
    loading = true;
    error = null;
    
    try {
      // Calculate start and end dates for the current week
      const weekDays = getWeekDays(currentDate);
      const startDate = weekDays[0];
      const endDate = weekDays[6];
      
      console.log('Loading availability for date range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const response = await fetch(
        `/api/available-slots?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      
      if (!response.ok) {
        console.error('API response not ok:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response data:', data);

      if (Array.isArray(data)) {
        // Ensure dates are properly parsed
        availableSlots = data.map(slot => ({
          id: slot.id,
          date: new Date(slot.date).toISOString(),  // Store as ISO string
          startTime: slot.startTime,
          endTime: slot.endTime,
          midwife: slot.midwife
        }));
        console.log('Processed available slots:', availableSlots.map(slot => ({
          date: slot.date,
          startTime: slot.startTime,
          midwife: slot.midwife
        })));
      } else {
        console.error('Unexpected data format:', data);
        throw new Error('Invalid data format received');
      }
    } catch (e) {
      console.error('Error loading slots:', e);
      error = 'Failed to load available slots. Please try again.';
    } finally {
      loading = false;
    }
  }

  function getAvailableSlotsForDay(day) {
    const dayString = day.toISOString().split('T')[0];
    console.log('Checking slots for day:', dayString);
    
    // Log the array state
    console.log('Available slots array state:', {
      isArray: Array.isArray(availableSlots),
      length: availableSlots.length,
      content: availableSlots
    });
    
    const slotsForDay = availableSlots.filter(slot => {
      const slotString = slot.date.split('T')[0];
      const matches = slotString === dayString;
      
      console.log('Comparing:', {
        slotDate: slotString,
        dayDate: dayString,
        matches: matches
      });
      
      return matches;
    });

    console.log('Found slots:', {
      day: dayString,
      count: slotsForDay.length,
      slots: slotsForDay
    });
    
    return slotsForDay;
  }

  function handleResize() {
    isMobile = window.innerWidth < 768;
  }

  function handleSlotSelection(slot) {
    console.log('Slot selected:', slot);
    selectedSlot = selectedSlot?.id === slot.id ? null : slot;
    console.log('Updated selected slot:', selectedSlot);
  }

  // Get start of current week
  function getStartOfWeek(date) {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() - date.getDay());
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  }

  // Check if we can go to previous week
  $: canGoPrevious = getStartOfWeek(currentDate) > getStartOfWeek(new Date());

  // Check if we can go to next week (allow booking up to 12 weeks ahead)
  $: canGoNext = getStartOfWeek(currentDate) < getStartOfWeek(new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000));

  function previousWeek() {
    if (canGoPrevious) {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      currentDate = newDate;
      console.log('Moving to previous week:', currentDate.toDateString());
      loadAvailability();
    }
  }

  function nextWeek() {
    if (canGoNext) {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      currentDate = newDate;
      console.log('Moving to next week:', currentDate.toDateString());
      loadAvailability();
    }
  }

  onMount(() => {
    console.log('Calendar component mounted');
    handleResize();
    window.addEventListener('resize', handleResize);
    
    // Initialize currentDate to start of current week if it's in the past
    const today = new Date();
    if (getStartOfWeek(currentDate) < getStartOfWeek(today)) {
      currentDate = today;
    }
    
    loadAvailability();

    return () => window.removeEventListener('resize', handleResize);
  });
  
  // Make weekDays and slots reactive
  $: weekDays = getWeekDays(currentDate);
  $: {
    console.log('Reactive update - available slots:', availableSlots);
    if (weekDays && weekDays.length > 0) {
      weekDays.forEach(day => {
        const daySlots = getAvailableSlotsForDay(day);
        console.log(`Reactive check - ${day.toDateString()}:`, daySlots);
      });
    }
  }
</script>

<div>
  <!-- Loading State -->
  {#if loading}
    <div class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
    </div>
  {/if}

  <!-- Error State -->
  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
      <span class="block sm:inline">{error}</span>
    </div>
  {/if}

  <div class="flex justify-between items-center mb-4">
    {#if isMobile}
      <button 
        class="p-2 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={previousWeek}
        disabled={!canGoPrevious}
        aria-label="Previous Week">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" 
          stroke={canGoPrevious ? "currentColor" : "#9CA3AF"} 
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h3 class="text-lg font-semibold">
        {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
        {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </h3>
      <button 
        class="p-2 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={nextWeek}
        disabled={!canGoNext}
        aria-label="Next Week">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" 
          stroke={canGoNext ? "currentColor" : "#9CA3AF"} 
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    {:else}
      <button 
        class="px-4 py-2 bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={previousWeek}
        disabled={!canGoPrevious}>
        Previous Week
      </button>
      <h3 class="text-lg font-semibold">
        Week of {weekDays[0].toLocaleDateString()}
      </h3>
      <button 
        class="px-4 py-2 bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={nextWeek}
        disabled={!canGoNext}>
        Next Week
      </button>
    {/if}
  </div>

  <!-- Desktop View -->
  <div class="grid grid-cols-7 gap-4">
    {#each weekDays as day}
      <div class="border rounded-lg p-2">
        <h4 class="text-center font-semibold mb-2">
          {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </h4>
        <div class="space-y-2">
          {#each getAvailableSlotsForDay(day) as slot}
            <button
              class="w-full p-2 text-left rounded-lg transition-colors {selectedSlot?.id === slot.id ? 'bg-green-700 text-white' : 'bg-green-100 hover:bg-green-200'}"
              on:click={() => handleSlotSelection(slot)}>
              <div class="text-sm font-medium">{slot.startTime}</div>
              <div class="text-xs opacity-75">with {slot.midwife}</div>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* Add any additional styles here */
</style>