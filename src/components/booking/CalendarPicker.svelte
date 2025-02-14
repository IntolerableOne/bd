<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    const dispatch = createEventDispatcher();
    
    // Props
    export let availableSlots = [
      // Example data structure - this will come from your backend later
      {
        date: '2025-02-14',
        slots: [
          { time: '09:00', available: true },
          { time: '10:00', available: true },
          { time: '11:00', available: false },
          { time: '14:00', available: true },
          { time: '15:00', available: true }
        ]
      }
    ];
  
    // State
    let currentDate = new Date();
    let selectedDate: Date | null = null;
    let selectedSlot: { time: string, available: boolean } | null = null;
    
    // Calendar generation
    $: currentMonth = currentDate.getMonth();
    $: currentYear = currentDate.getFullYear();
    $: daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    $: firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    
    $: calendarDays = Array.from({ length: daysInMonth }, (_, i) => ({
      date: new Date(currentYear, currentMonth, i + 1),
      dayOfMonth: i + 1
    }));
  
    function getMonthName(date: Date): string {
      return date.toLocaleString('default', { month: 'long' });
    }
    
    // Methods
    function previousMonth() {
      currentDate = new Date(currentYear, currentMonth - 1);
    }
    
    function nextMonth() {
      currentDate = new Date(currentYear, currentMonth + 1);
    }
    
    function selectDate(date: Date) {
      selectedDate = date;
      selectedSlot = null;
    }
    
    function selectTimeSlot(slot: { time: string, available: boolean }) {
      selectedSlot = slot;
      if (selectedDate) {
        dispatch('selection', {
          date: selectedDate,
          time: slot.time
        });
      }
    }
    
    function formatDate(date: Date): string {
      return date.toISOString().split('T')[0];
    }
    
    // Get time slots for selected date
    $: selectedDateSlots = selectedDate 
      ? (availableSlots.find(d => d.date === formatDate(selectedDate))?.slots || [])
      : [];
  </script>
  
  <div class="calendar-container" role="application" aria-label="Appointment Calendar">
    <!-- Month Navigation -->
    <div class="flex justify-between items-center mb-4">
      <button 
        on:click={previousMonth}
        class="p-2 hover:bg-green-50 rounded-full"
        aria-label="Previous month, {getMonthName(new Date(currentYear, currentMonth - 1))}">
        <span class="sr-only">Previous month</span>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <h3 class="text-lg font-semibold" aria-live="polite">
        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
      </h3>
      
      <button 
        on:click={nextMonth}
        class="p-2 hover:bg-green-50 rounded-full"
        aria-label="Next month, {getMonthName(new Date(currentYear, currentMonth + 1))}">
        <span class="sr-only">Next month</span>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  
    <!-- Calendar Grid -->
    <div class="calendar-grid" role="grid" aria-label="Calendar">
      <!-- Week days header -->
      <div class="calendar-weekdays" role="row">
        {#each ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as day, i}
          <div class="text-center font-medium text-sm py-2" role="columnheader" aria-label={day}>
            {day.slice(0, 3)}
          </div>
        {/each}
      </div>
  
      <!-- Calendar days -->
      <div class="calendar-days" role="rowgroup">
        {#each Array(firstDayOfMonth).fill(null) as _}
          <div class="empty-day" role="gridcell" aria-hidden="true"></div>
        {/each}
  
        {#each calendarDays as { date, dayOfMonth }}
          {@const isAvailable = availableSlots.some(d => d.date === formatDate(date))}
          {@const isSelected = selectedDate && formatDate(date) === formatDate(selectedDate)}
          <button
            class="calendar-day"
            class:selected={isSelected}
            class:has-slots={isAvailable}
            disabled={date < new Date()}
            aria-label="{date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} {isAvailable ? 'Available' : 'No appointments available'}"
            role="gridcell">
            {dayOfMonth}
          </button>
        {/each}
      </div>
    </div>
  
    <!-- Time Slots -->
    {#if selectedDate}
      <div class="mt-6" role="region" aria-label="Available time slots">
        <h4 class="font-medium mb-3">
          Available times for {selectedDate.toLocaleDateString()}:
        </h4>
        <div class="grid grid-cols-3 gap-2" role="group">
          {#each selectedDateSlots as slot}
            {@const isSelected = selectedSlot && selectedSlot.time === slot.time}
            <button
              class="time-slot"
              class:selected={isSelected}
              disabled={!slot.available}
              aria-pressed={isSelected}
              aria-label="Book appointment at {slot.time}"
              on:click={() => selectTimeSlot(slot)}>
              {slot.time}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
  
  <style>
    .calendar-grid {
      display: grid;
      gap: 1px;
      background-color: #e5e7eb;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      overflow: hidden;
    }
  
    .calendar-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background-color: #f9fafb;
    }
  
    .calendar-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background-color: white;
    }
  
    .calendar-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: white;
      border: none;
      font-size: 0.875rem;
    }
  
    .calendar-day:disabled {
      color: #d1d5db;
      cursor: not-allowed;
    }
  
    .calendar-day.has-slots:not(:disabled) {
      font-weight: 500;
      color: #15803d;
    }
  
    .calendar-day.selected {
      background-color: #15803d;
      color: white;
    }
  
    .empty-day {
      aspect-ratio: 1;
      background-color: white;
    }
  
    .time-slot {
      padding: 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 0.375rem;
      background-color: white;
      font-size: 0.875rem;
      transition: all 150ms;
    }
  
    .time-slot:hover:not(:disabled) {
      border-color: #15803d;
      background-color: #f0fdf4;
    }
  
    .time-slot:disabled {
      color: #d1d5db;
      cursor: not-allowed;
    }
  
    .time-slot.selected {
      background-color: #15803d;
      border-color: #15803d;
      color: white;
    }
  </style>