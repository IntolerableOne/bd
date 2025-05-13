<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let selectedMidwife;
  // export let currentDate; // REMOVE THIS LINE - It's unused
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

    const slot = slots.find(s => {
      const slotDate = new Date(s.date);
      return slotDate.toDateString() === day.toDateString() && 
             s.startTime === timeSlot.start &&
             s.midwife === selectedMidwife;
    });

    if (!slot) return null;

    return {
      ...slot,
      status: getSlotStatus(slot)
    };
  }

  function getSlotStatus(slot) {
    if (slot.booking?.paid) return 'booked';
    if (slot.hold && new Date(slot.hold.expiresAt) > new Date()) return 'held';
    return 'available';
  }

  function handleSlotClick(day, timeSlot) {
    const existingSlot = isSlotAvailable(day, timeSlot);
    if (existingSlot?.disabled) return;
    
    // Only allow modifying available slots
    if (existingSlot?.status === 'booked' || existingSlot?.status === 'held') return;
    
    if (existingSlot) {
      dispatch('removeSlot', existingSlot);
    } else {
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
    if (!slot?.booking && !slot?.hold) return;
    
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
    
    if (slot.booking) {
      tooltipData = {
        type: 'booking',
        name: slot.booking.name,
        email: slot.booking.email,
        date: formatDate(slot.date),
        time: slot.startTime,
        paid: slot.booking.paid
      };
    } else if (slot.hold) {
      const expiresAt = new Date(slot.hold.expiresAt);
      tooltipData = {
        type: 'hold',
        date: formatDate(slot.date),
        time: slot.startTime,
        expiresIn: Math.max(0, Math.floor((expiresAt - new Date()) / 1000 / 60)) // minutes
      };
    }
    
    tooltipVisible = true;
  }

  function hideTooltip() {
    tooltipVisible = false;
    tooltipData = null;
  }

  function getSlotClass(slot) {
    if (slot?.disabled) return 'bg-gray-100 cursor-not-allowed';
    if (!slot) return 'hover:bg-green-50 border border-green-200';
    
    switch (slot.status) {
      case 'booked':
        return 'bg-gray-200 cursor-not-allowed';
      case 'held':
        return 'bg-yellow-100';
      default:
        return 'bg-green-100 hover:bg-green-200';
    }
  }
</script>

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
              class="w-full py-3 px-4 text-left rounded-lg text-sm transition-colors relative {getSlotClass(slot)}"
              on:click={() => handleSlotClick(day, timeSlot)}
              on:mouseenter={(e) => showTooltip(e, slot)}
              on:mouseleave={hideTooltip}
              on:focus={(e) => showTooltip(e, slot)}
              on:blur={hideTooltip}
              disabled={slot?.disabled || slot?.status === 'booked' || slot?.status === 'held'}>
              <div class="flex justify-between items-center">
                <span class="font-medium">{timeSlot.start}</span>
                <span>
                  {#if slot?.disabled}
                    <span class="text-gray-500 text-xs">Expired</span>
                  {:else if slot?.status === 'booked'}
                    <span>🔒</span>
                  {:else if slot?.status === 'held'}
                    <span>⏳</span>
                  {:else if slot}
                    <span class="text-red-500 hover:text-red-700">×</span>
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

<div class="hidden md:block">
  <div class="grid grid-cols-7 gap-2">
    {#each viewDates as day}
      <div class="border rounded-lg p-2 min-h-[180px] bg-white">
        <h4 class="text-center font-semibold mb-2">
          {formatDate(day)}
        </h4>
        <div class="space-y-1">
          {#each timeSlots as timeSlot}
            {@const slot = isSlotAvailable(day, timeSlot)}
            <button
              class="w-full p-2 text-left rounded text-sm transition-colors relative {getSlotClass(slot)}"
              on:click={() => handleSlotClick(day, timeSlot)}
              on:mouseenter={(e) => showTooltip(e, slot)}
              on:mouseleave={hideTooltip}
              on:focus={(e) => showTooltip(e, slot)}
              on:blur={hideTooltip}
              disabled={slot?.disabled || slot?.status === 'booked' || slot?.status === 'held'}>
              <div class="flex justify-between items-center">
                <span>{timeSlot.start}</span>
                <span>
                  {#if slot?.disabled}
                    <span class="text-gray-500 text-xs">Expired</span>
                  {:else if slot?.status === 'booked'}
                    <span>🔒</span>
                  {:else if slot?.status === 'held'}
                    <span>⏳</span>
                  {:else if slot}
                    <span class="text-red-500 hover:text-red-700">×</span>
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


{#if tooltipVisible && tooltipData}
  <div
    class="fixed z-50 bg-white rounded-lg shadow-lg p-3 w-64 transition-opacity duration-150"
    style="
      left: {tooltipPosition.x}px;
      top: {tooltipPosition.y}px;
      transform: translate(-50%, {window.innerWidth < 768 ? '10px' : '-100%'}); /* Adjusted for mobile */
    "
  >
    <div class="flex flex-col space-y-1">
      {#if tooltipData.type === 'booking'}
        <p class="font-semibold">{tooltipData.name}</p>
        <p class="text-sm text-gray-600">{tooltipData.email}</p>
        <p class="text-sm text-gray-600">{tooltipData.date} at {tooltipData.time}</p>
        <p class="text-sm font-medium {tooltipData.paid ? 'text-green-600' : 'text-yellow-600'}">
          {tooltipData.paid ? 'Payment Confirmed' : 'Payment Pending'}
        </p>
      {:else if tooltipData.type === 'hold'}
        <p class="font-semibold">Slot on Hold</p>
        <p class="text-sm text-gray-600">{tooltipData.date} at {tooltipData.time}</p>
        <p class="text-sm text-yellow-600">
          Expires in {tooltipData.expiresIn} minute{tooltipData.expiresIn !== 1 ? 's' : ''}
        </p>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Prevent tooltip from getting cut off if body tries to scroll x */
  :global(body) {
    overflow-x: hidden;
  }

  /* REMOVE THE EMPTY RULESETS THAT WERE HERE: */
  /* [style*="transform: translate(-50%, -100%)"] { ... }
  @media (max-width: 767px) {
    [style*="transform: translate(-50%, 10px)"] { ... }
  }
  */
</style>