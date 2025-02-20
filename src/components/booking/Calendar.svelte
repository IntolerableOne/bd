<script>
  import { onMount } from 'svelte';
  
  export let selectedSlot = null;
  let currentDate = new Date();
  let isMobile = false;
  let availableSlots = [];
  let loading = false;
  let error = null;
  let initialized = false;

  const timeSlots = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '13:00', end: '14:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' }
  ];

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

  function isSlotAvailable(day, timeSlot) {
    // Create a date object for this slot
    const slotDateTime = new Date(day);
    const [hours, minutes] = timeSlot.start.split(':');
    slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Get current time plus 2 hours
    const minDateTime = new Date(Date.now() + (2 * 60 * 60 * 1000));

    // If slot is in the past or within next 2 hours, it's not available
    if (slotDateTime <= minDateTime) {
      return null;
    }

    return availableSlots.find(slot => {
      const slotDate = new Date(slot.date);
      return slotDate.toDateString() === day.toDateString() && 
             slot.startTime === timeSlot.start;
    });
  }

  async function loadAvailability() {
    if (loading) return;
    
    loading = true;
    error = null;
    availableSlots = [];
    
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

      availableSlots = data;
      initialized = true;
    } catch (e) {
      console.error('Error loading slots:', e);
      error = 'Failed to load available slots. Please try again.';
      availableSlots = [];
    } finally {
      loading = false;
    }
  }

  function handleSlotSelection(slot) {
    selectedSlot = selectedSlot?.id === slot.id ? null : slot;
  }

  function handleResize() {
    isMobile = window.innerWidth < 768;
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

  $: weekDays = getWeekDays(currentDate);
  $: {
    if (initialized && availableSlots.length > 0) {
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
    await loadAvailability();
    return () => window.removeEventListener('resize', handleResize);
  });
</script>

<!-- Mobile View -->
<div class="block md:hidden">
  <div class="flex justify-between items-center mb-4">
    <button 
      on:click={previousWeek}
      class="p-2 rounded-lg hover:bg-green-100">
      Previous Week
    </button>
    <h3 class="text-lg font-semibold">
      {weekDays[0].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - 
      {weekDays[6].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
    </h3>
    <button 
      on:click={nextWeek}
      class="p-2 rounded-lg hover:bg-green-100">
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
        {@const daySlots = availableSlots.filter(slot => {
          const slotDate = new Date(slot.date);
          return slotDate.toDateString() === day.toDateString();
        })}
        {#if daySlots.length > 0}
          <div class="border rounded-lg p-4 bg-white">
            <h4 class="font-semibold mb-3">
              {day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </h4>
            <div class="space-y-2">
              {#each timeSlots as timeSlot}
                {@const slot = isSlotAvailable(day, timeSlot)}
                {#if slot}
                  <button
                    class="w-full p-3 text-left rounded-lg transition-colors
                      {selectedSlot?.id === slot.id ? 
                        'bg-green-700 text-white' : 
                        'bg-green-50 hover:bg-green-100 border border-green-200'}"
                    on:click={() => handleSlotSelection(slot)}>
                    <div class="text-sm font-medium">{timeSlot.start}</div>
                  </button>
                {/if}
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
      class="p-2 rounded-lg hover:bg-green-100">
      Previous Week
    </button>
    <h3 class="text-lg font-semibold">
      {weekDays[0].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - 
      {weekDays[6].toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
    </h3>
    <button 
      on:click={nextWeek}
      class="p-2 rounded-lg hover:bg-green-100">
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
        <div class="border rounded-lg p-4 bg-white min-h-[150px]">
          <h4 class="font-semibold mb-3 text-center">
            {day.getDate()}
          </h4>
          <div class="space-y-2">
            {#each timeSlots as timeSlot}
              {@const slot = isSlotAvailable(day, timeSlot)}
              {#if slot}
                <button
                  class="w-full p-2 text-left rounded-lg text-sm transition-colors
                    {selectedSlot?.id === slot.id ? 
                      'bg-green-700 text-white' : 
                      'bg-green-50 hover:bg-green-100 border border-green-200'}"
                  on:click={() => handleSlotSelection(slot)}>
                  <div class="text-sm font-medium">{timeSlot.start}</div>
                </button>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>