<script>
  export let bookings = [];
  export let searchTerm = '';
  export let filterMidwife = 'all';
  export let filterDateRange = 'all';
  export let filterStatus = 'all';

  $: filteredBookings = bookings
    .filter(booking => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        booking.name.toLowerCase().includes(searchLower) ||
        booking.email.toLowerCase().includes(searchLower);

      const matchesMidwife = filterMidwife === 'all' || 
        booking.availability.midwife === filterMidwife;

      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'confirmed' && booking.status === 'CONFIRMED') ||
        (filterStatus === 'pending' && booking.status === 'PENDING') || 
        (filterStatus === 'cancelled' && booking.status === 'CANCELLED');

      let matchesDate = true;
      if (filterDateRange !== 'all') {
        const bookingDate = new Date(booking.availability.date);
        const now = new Date();
        switch (filterDateRange) {
          case 'today':
            matchesDate = bookingDate.toDateString() === now.toDateString();
            break;
          case 'week':
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            matchesDate = bookingDate >= weekAgo;
            break;
          case 'month':
            const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
            matchesDate = bookingDate >= monthAgo;
            break;
        }
      }

      return matchesSearch && matchesMidwife && matchesDate && matchesStatus;
    })
    .sort((a, b) => new Date(b.availability.date) - new Date(a.availability.date));

  function formatTime(timeString) {
    // Convert 24-hour format to 12-hour format with AM/PM
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
</script>

<div class="bg-white p-6 rounded-lg shadow overflow-hidden">
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-xl font-bold">Bookings</h2>
    
    <div class="flex space-x-2">
      <select 
        bind:value={filterStatus}
        class="px-3 py-2 border rounded-md text-sm">
        <option value="all">All Statuses</option>
        <option value="confirmed">Confirmed</option>
        <option value="pending">Pending</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>
  </div>
  
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead>
        <tr class="bg-gray-50">
          <th class="px-4 py-2 text-left">Date</th>
          <th class="px-4 py-2 text-left">Time</th>
          <th class="px-4 py-2 text-left">Client</th>
          <th class="px-4 py-2 text-left">Email</th>
          <th class="px-4 py-2 text-left">Midwife</th>
          <th class="px-4 py-2 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredBookings as booking (booking.id)}
          <tr class="border-t hover:bg-gray-50">
            <td class="px-4 py-2">
              {new Date(booking.availability.date).toLocaleDateString('en-GB')}
            </td>
            <td class="px-4 py-2">{formatTime(booking.availability.startTime)}</td>
            <td class="px-4 py-2">{booking.name}</td>
            <td class="px-4 py-2">{booking.email}</td>
            <td class="px-4 py-2">{booking.availability.midwife}</td>
            <td class="px-4 py-2">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                {booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 
                 booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                 'bg-red-100 text-red-800'}">
                {booking.status === 'CONFIRMED' ? 'Confirmed' : 
                 booking.status === 'PENDING' ? 'Pending' : 'Cancelled'}
              </span>
            </td>
          </tr>
        {/each}
        {#if filteredBookings.length === 0}
          <tr>
            <td colspan="6" class="px-4 py-8 text-center text-gray-500">
              No bookings found matching your filters
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>