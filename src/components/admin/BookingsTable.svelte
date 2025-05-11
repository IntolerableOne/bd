<script>
    export let bookings = [];
    export let searchTerm = '';
    export let filterStatus = 'all';
    export let filterMidwife = 'all';
    export let filterDateRange = 'all';
  
    $: confirmedBookings = bookings.filter(booking => booking.paid);
  
    $: filteredBookings = confirmedBookings
      .filter(booking => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
          booking.name.toLowerCase().includes(searchLower) ||
          booking.email.toLowerCase().includes(searchLower);
  
        const matchesMidwife = filterMidwife === 'all' || 
          booking.availability.midwife === filterMidwife;
  
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
  
        return matchesSearch && matchesMidwife && matchesDate;
      })
      .sort((a, b) => new Date(b.availability.date) - new Date(a.availability.date));
  </script>
  
  <div class="bg-white p-6 rounded-lg shadow overflow-hidden">
    <h2 class="text-xl font-bold mb-4">Confirmed Bookings</h2>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="bg-gray-50">
            <th class="px-4 py-2 text-left">Date</th>
            <th class="px-4 py-2 text-left">Time</th>
            <th class="px-4 py-2 text-left">Client</th>
            <th class="px-4 py-2 text-left">Email</th>
            <th class="px-4 py-2 text-left">Midwife</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredBookings as booking (booking.id)}
            <tr class="border-t hover:bg-gray-50">
              <td class="px-4 py-2">
                {new Date(booking.availability.date).toLocaleDateString('en-GB')}
              </td>
              <td class="px-4 py-2">{booking.availability.startTime}</td>
              <td class="px-4 py-2">{booking.name}</td>
              <td class="px-4 py-2">{booking.email}</td>
              <td class="px-4 py-2">{booking.availability.midwife}</td>
            </tr>
          {/each}
          {#if filteredBookings.length === 0}
            <tr>
              <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                No confirmed bookings found matching your filters
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>