<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
  
    export let selectedMidwife;
    export let currentDate;
    export let slots = [];
    export let viewDates = [];
  
    let tooltipData = null;
    let tooltipPosition = { x: 0, y: 0 };
    let tooltipVisible = false;
  
    const timeSlots = [
      { start: '09:00', end: '10:00' },
      { start: '10:00', end: '11:00' },
      { start: '11:00', end: '12:00' },
      { start: '13:00', end: '14:00' },
      { start: '14:00', end: '15:00' },
      { start: '15:00', end: '16:00' },
      { start: '16:00', end: '17:00' }
    ];
  
    function isSlotAvailable(day, timeSlot) {
      // Create a date object for this slot
      const slotDateTime = new Date(day);
      const [hours, minutes] = timeSlot.start.split(':');
      slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
      // Get current time plus 2 hours
      const minDateTime = new Date(Date.now() + (2 * 60 * 60 * 1000));
  
      // If slot is in the past or within next 2 hours, show as unavailable
      if (slotDateTime <= minDateTime) {
        return {
          disabled: true,
          reason: 'Too soon to book'
        };
      }
  
      return slots.find(slot => {
        const slotDate = new Date(slot.date);
        return slotDate.toDateString() === day.toDateString() && 
               slot.startTime === timeSlot.start &&
               slot.midwife === selectedMidwife;
      });
    }
  
    function handleSlotClick(day, timeSlot) {
      const existingSlot = isSlotAvailable(day, timeSlot);
      if (existingSlot?.disabled) return;
      
      if (existingSlot && !existingSlot.booking?.paid) {
        dispatch('removeSlot', existingSlot);
      } else if (!existingSlot) {
        dispatch('addSlot', { day, timeSlot });
      }
    }
  
    function formatDate(date) {
      return new Date(date).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    }
  
    function showTooltip(event, slot) {
      if (!slot?.booking) return;
      
      const rect = event.target.getBoundingClientRect();
      const scrollY = window.scrollY;
      
      // Position tooltip above the slot on desktop, below on mobile
      const isMobile = window.innerWidth < 768;
      tooltipPosition = {
        x: rect.left + (rect.width / 2),
        y: isMobile ? 
          rect.bottom + scrollY + 10 : // 10px below on mobile
          rect.top + scrollY - 10 // 10px above on desktop
      };
      
      tooltipData = {
        name: slot.booking.name,
        email: slot.booking.email,
        date: formatDate(slot.date),
        time: slot.startTime,
        paid: slot.booking.paid
      };
      
      tooltipVisible = true;
    }
  
    function hideTooltip() {
      tooltipVisible = false;
      tooltipData = null;
    }
  </script>
  
  <!-- Mobile View -->
  <div class="block md:hidden">
    <div class="grid grid-cols-1 gap-4">
      {#each viewDates as day}
        <div class="border rounded-lg p-4 bg-white shadow-sm">
          <h4 class="text-center font-semibold mb-4">
            {formatDate(day)}
          </h4>
          <div class="space-y-2">
            {#each timeSlots as timeSlot}
              {@const slot = isSlotAvailable(day, timeSlot)}
              <button
                class="w-full py-3 px-4 text-left rounded-lg text-sm transition-colors relative
                  {slot?.disabled ? 
                    'bg-gray-100 cursor-not-allowed' :
                    slot ? 
                      slot.booking?.paid ? 
                        'bg-gray-200 cursor-not-allowed' : 
                        slot.booking ? 
                          'bg-yellow-100 hover:bg-yellow-200' : 
                          'bg-green-100 hover:bg-green-200' : 
                      'hover:bg-green-50 border border-green-200'}"
                on:click={() => handleSlotClick(day, timeSlot)}
                on:mouseenter={(e) => showTooltip(e, slot)}
                on:mouseleave={hideTooltip}
                on:focus={(e) => showTooltip(e, slot)}
                on:blur={hideTooltip}
                disabled={slot?.booking?.paid || slot?.disabled}
                title={slot?.disabled ? slot.reason : ''}>
                <div class="flex justify-between items-center">
                  <span class="font-medium">{timeSlot.start}</span>
                  <span>
                    {#if slot?.disabled}
                      <span class="text-gray-500 text-xs">Too soon</span>
                    {:else if slot && !slot.booking}
                      <span class="text-red-500 hover:text-red-700">×</span>
                    {:else if slot?.booking?.paid}
                      <span>🔒</span>
                    {:else if slot?.booking}
                      <span>⏳</span>
                    {/if}
                  </span>
                </div>
                {#if slot?.booking}
                  <div class="text-xs text-gray-600 mt-1">
                    {slot.booking.name}
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- Desktop View -->
  <div class="hidden md:block">
    <div class="grid grid-cols-7 gap-2">
      {#each viewDates as day}
        <div class="border rounded-lg p-2 min-h-[180px] bg-white {day.getMonth() !== currentDate.getMonth() ? 'opacity-50' : ''}">
          <h4 class="text-center font-semibold mb-2">
            {formatDate(day)}
          </h4>
          <div class="space-y-1">
            {#each timeSlots as timeSlot}
              {@const slot = isSlotAvailable(day, timeSlot)}
              <button
                class="w-full p-2 text-left rounded text-sm transition-colors relative
                  {slot?.disabled ? 
                    'bg-gray-100 cursor-not-allowed' :
                    slot ? 
                      slot.booking?.paid ? 
                        'bg-gray-200 cursor-not-allowed' : 
                        slot.booking ? 
                          'bg-yellow-100 hover:bg-yellow-200' : 
                          'bg-green-100 hover:bg-green-200' : 
                      'hover:bg-green-50 border border-green-200'}"
                on:click={() => handleSlotClick(day, timeSlot)}
                on:mouseenter={(e) => showTooltip(e, slot)}
                on:mouseleave={hideTooltip}
                on:focus={(e) => showTooltip(e, slot)}
                on:blur={hideTooltip}
                disabled={slot?.booking?.paid || slot?.disabled}
                title={slot?.disabled ? slot.reason : ''}>
                <div class="flex justify-between items-center">
                  <span>{timeSlot.start}</span>
                  <span>
                    {#if slot?.disabled}
                      <span class="text-gray-500 text-xs">Too soon</span>
                    {:else if slot && !slot.booking}
                      <span class="text-red-500 hover:text-red-700">×</span>
                    {:else if slot?.booking?.paid}
                      <span>🔒</span>
                    {:else if slot?.booking}
                      <span>⏳</span>
                    {/if}
                  </span>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- Tooltip -->
  {#if tooltipVisible && tooltipData}
    <div
      class="fixed z-50 bg-white rounded-lg shadow-lg p-3 w-64 transition-opacity duration-150"
      style="
        left: {tooltipPosition.x}px;
        top: {tooltipPosition.y}px;
        transform: translate(-50%, -100%);
      "
    >
      <div class="flex flex-col space-y-1">
        <p class="font-semibold">{tooltipData.name}</p>
        <p class="text-sm text-gray-600">{tooltipData.email}</p>
        <p class="text-sm text-gray-600">{tooltipData.date} at {tooltipData.time}</p>
        <p class="text-sm font-medium {tooltipData.paid ? 'text-green-600' : 'text-yellow-600'}">
          {tooltipData.paid ? 'Payment Confirmed' : 'Payment Pending'}
        </p>
      </div>
    </div>
  {/if}
  
  <style>
    /* Prevent tooltip from getting cut off */
    :global(body) {
      overflow-x: hidden;
    }
  </style>