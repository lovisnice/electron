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
          this.messages.push({ id: data.event_id, body: msg, sender: this.userId, timestamp: Date.now(), edited: false });
        } else {
          console.error('Send failed:', data);
        }
      } catch (e) {
        console.error('Send message error:', e);
      }
}

// Edit mode management
function startEdit(messageId, currentBody) {
  this.editMode = messageId;
  this.editText = currentBody;
  this.$nextTick(() => {
    const textarea = document.querySelector(`[x-show="editMode === '${messageId}'"] textarea`);
    if (textarea) textarea.focus();
  });
}

function cancelEdit() {
  this.editMode = null;
  this.editText = '';
}

// Save edited message
async function saveEdit(messageId) {
  if (!this.editText.trim()) return;

  try {
    const res = await fetch(
      `https://matrix.org/_matrix/client/r0/rooms/${encodeURIComponent(this.roomId)}/send/m.room.message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          msgtype: 'm.text',
          body: this.editText.trim(),
          'm.new_content': {
            msgtype: 'm.text',
            body: this.editText.trim()
          },
          'm.relates_to': {
            rel_type: 'm.replace',
            event_id: messageId
          }
        })
      }
    );

    const data = await res.json();
    if (data.event_id) {
      // Update locally
      const msg = this.messages.find(m => m.id === messageId);
      if (msg) {
        msg.body = this.editText.trim();
        msg.edited = true;
      }
      this.cancelEdit();
      if (window && typeof window.showToast === 'function') window.showToast('Message edited', 3000);
    } else {
      if (window && typeof window.showToast === 'function') window.showToast('Error editing message: ' + (data.error || ''), 5000);
    }
  } catch (e) {
    console.error('Edit error:', e);
    if (window && typeof window.showToast === 'function') window.showToast('Error: ' + e.message, 5000);
  }
}

// Delete message
async function deleteMessage(messageId) {
  if (!confirm('Delete message?')) return;

  try {
    const res = await fetch(
      `https://matrix.org/_matrix/client/r0/rooms/${encodeURIComponent(this.roomId)}/redact/${messageId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (res.ok) {
      this.messages = this.messages.filter(m => m.id !== messageId);
      if (window && typeof window.showToast === 'function') window.showToast('Message deleted', 3000);
    } else {
      const data = await res.json();
      if (window && typeof window.showToast === 'function') window.showToast('Failed to delete: ' + (data.error || ''), 5000);
    }
  } catch (e) {
    console.error('Delete error:', e);
    if (window && typeof window.showToast === 'function') window.showToast('Error: ' + e.message, 5000);
  }
}

// Play notification sound
function playNotificationSound() {
  try {
    const audio = new Audio('./components/chat/assets/ping.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Sound blocked:', e));
  } catch (e) {
    console.warn('playNotificationSound error:', e);
  }
}

// Show desktop notification
function showDesktopNotification(sender, body) {
  if (Notification.permission !== 'granted') return;

  const title = sender === this.userId ? 'You' : sender.split(':')[0].substring(1);
  const options = {
    body: body.length > 100 ? body.substring(0, 97) + '...' : body,
    tag: 'matrix-chat',
    renotify: true
  };

  const notification = new Notification(title, options);

  // Close after 5 sec
  setTimeout(() => notification.close(), 5000);

  // Click to focus
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
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
            .map(event => {
              const edited = event.content['m.new_content'] ? true : false;
              return {
                id: event.event_id,
                body: event.content['m.new_content'] ? event.content['m.new_content'].body : event.content.body,
                sender: event.sender,
                timestamp: event.origin_server_ts,
                edited: edited
              };
            });
          
          // Check for new messages and notify
          newMessages.forEach(msg => {
            if (!this.messages.find(m => m.id === msg.id)) {
              // New message notification
              if (msg.sender !== this.userId && (document.hidden || this.roomId !== this.roomId)) {
                this.showDesktopNotification(msg.sender, msg.body);
                this.playNotificationSound();
              }
            }
          });
          
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

// Expose chat functions to window for Alpine proxies
try {
  if (typeof window !== 'undefined') {
    window.sendMessage = sendMessage;
    window.fetchMessages = fetchMessages;
    window.startEdit = startEdit;
    window.cancelEdit = cancelEdit;
    window.saveEdit = saveEdit;
    window.deleteMessage = deleteMessage;
    window.playNotificationSound = playNotificationSound;
    window.showDesktopNotification = showDesktopNotification;
  }
} catch (e) { console.warn('Expose chat functions to window failed:', e); }