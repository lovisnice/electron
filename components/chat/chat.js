async function sendMessage() {
      if (!this.newMessage.trim() || !this.roomId) {
        console.warn('No message or roomId');
        return;
      }
      const msg = this.newMessage.trim();
      this.newMessage = '';


      try {
        const res = await fetch(`https://matrix.org/_matrix/client/r0/rooms/${this.roomId}/send/m.room.message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`
          },
          body: JSON.stringify({ msgtype: 'm.text', body: msg })
        });
        const data = await res.json();
        if (data.event_id) {
          this.messages.push({ id: data.event_id, body: msg, sender: this.userId, timestamp: Date.now() });
        } else {
          console.error('Send failed:', data);
        }
      } catch (e) {
        console.error('Send message error:', e);
      }
}


async function fetchMessages() {
      if (!this.accessToken || !this.roomId) return;
      try {
        const url = `https://matrix.org/_matrix/client/r0/rooms/${encodeURIComponent(this.roomId)}/messages?access_token=${this.accessToken}&dir=b&limit=50`;
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });
        const data = await res.json();
        if (data.chunk) {
          const newMessages = data.chunk
            .filter(event => event.type === 'm.room.message')
            .reverse()
            .map(event => ({
              id: event.event_id,
              body: event.content.body,
              sender: event.sender,
              timestamp: event.origin_server_ts
            }));
          
          // Замінити старі повідомлення на нові (або додати до них)
          this.messages = newMessages;
          console.log('Fetched messages:', newMessages.length);
        } else {
          console.warn('No messages in response:', data);
        }
      } catch (e) {
        console.error('Fetch messages error:', e);
      }
    }