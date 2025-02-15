<script>
    let selectedMidwife = '';
    let selectedDate = '';
    let availableSlots = [];
    
    // Generate time slots from 9 AM to 5 PM
    const timeSlots = Array.from({ length: 8 }, (_, i) => {
      const hour = i + 9;
      return `${hour.toString().padStart(2, '0')}:00`;
    });
  
    function handleAddSlot(time) {
      if (!selectedDate || !selectedMidwife) return;
      
      const newSlot = {
        midwife: selectedMidwife,
        date: selectedDate,
        time,
        id: Date.now() // temporary ID for demo
      };
      
      availableSlots = [...availableSlots, newSlot];
    }
  
    function handleRemoveSlot(slotToRemove) {
      availableSlots = availableSlots.filter(slot => slot.id !== slotToRemove.id);
    }
  
    $: sortedSlots = availableSlots.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateA - dateB;
    });
  
    // Get next 3 weeks of dates
    const dates = Array.from({ length: 21 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return date.toISOString().split('T')[0];
    });
  </script>
  
  <div class="mx-auto p-6 bg-white rounded-lg shadow-sm">
    <h2 class="text-3xl font-bold text-gray-800 mb-6">Availability Management</h2>
    
    <!-- Midwife Selection -->
    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-4">Select Midwife</label>
      <div class="flex gap-4">
        <button 
          class="px-4 py-2 rounded-md {selectedMidwife === 'Clare' ? 'bg-green-700 text-white' : 'bg-gray-100'}"
          on:click={() => selectedMidwife = 'Clare'}>
          Clare
        </button>
        <button 
          class="px-4 py-2 rounded-md {selectedMidwife === 'Natalie' ? 'bg-green-700 text-white' : 'bg-gray-100'}"
          on:click={() => selectedMidwife = 'Natalie'}>
          Natalie
        </button>
      </div>
    </div>
  
    <!-- Date Selection -->
    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-4">Select Date</label>
      <select 
        bind:value={selectedDate}
        class="w-full p-2 border rounded-md">
        <option value="">Choose a date...</option>
        {#each dates as date}
          <option value={date}>{new Date(date).toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</option>
        {/each}
      </select>
    </div>
  
    <!-- Time Slots -->
    {#if selectedDate && selectedMidwife}
      <div class="mb-6">
        <h3 class="text-lg font-medium text-gray-800 mb-3">Add Available Time Slots</h3>
        <div class="grid grid-cols-4 gap-2">
          {#each timeSlots as time}
            <button
              class="p-2 text-sm border rounded-md hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500"
              on:click={() => handleAddSlot(time)}>
              {time}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  
    <!-- Available Slots List -->
    <div>
      <h3 class="text-lg font-medium text-gray-800 mb-3">Current Availability</h3>
      {#if sortedSlots.length === 0}
        <p class="text-gray-500 italic">No slots added yet</p>
      {:else}
        <div class="space-y-2">
          {#each sortedSlots as slot}
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <span class="font-medium">{slot.midwife}</span>
                <span class="mx-2">|</span>
                <span>{new Date(slot.date).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}</span>
                <span class="mx-2">|</span>
                <span>{slot.time}</span>
              </div>
              <button
                class="p-2 text-red-600 hover:bg-red-50 rounded-md"
                on:click={() => handleRemoveSlot(slot)}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" 
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>