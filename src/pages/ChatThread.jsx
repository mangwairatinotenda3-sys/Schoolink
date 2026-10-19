    supabase.from('blocked_users').select('*').eq('blocker_id', user.id).eq('blocked_id', partnerId).maybeSingle().then(({ data }) => setIsBlocked(!!data))
    supabase.from('chat_settings').select('*').eq('user_id', user.id).eq('partner_id', partnerId).maybeSingle().then(({ data }) => {
      if (data) setMyChatSettings(data)
    })
  }, [partnerId])

  // Unsent text is kept per chat, so leaving the screen does not lose it.
  const draftKey = `schoolink_draft_${user?.id}_${partnerId}`
  useEffect(() => {
    try {
      setText(localStorage.getItem(draftKey) || '')
    } catch {
      setText('')
    }
    setReplyTo(null)
    setEditing(null)
    setShowEmojis(false)
  }, [partnerId])

  function updateText(value) {
    setText(value)
    setSendError('')
    if (!editing) {
      try {
        if (value) localStorage.setItem(draftKey, value)
        else localStorage.removeItem(draftKey)
      } catch {
        // ignore
      }
    }
    sendTyping(value)
  }

  function addMessage(m) {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
  }

  // Realtime: new messages, edits, deletes and read ticks, plus the "typing…" signal.
  useEffect(() => {
    if (!user) return undefined
    firstLoadRef.current = true
    stickToBottomRef.current = true
    setNewCount(0)
    loadMessages()

    const isThisThread = (m) => (m.sender_id === user.id && m.receiver_id === partnerId) || (m.sender_id === partnerId && m.receiver_id === user.id)

    const channel = supabase
      .channel(`chat-${user.id}-${partnerId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new
        if (!isThisThread(m)) return
        addMessage(m)
        if (m.receiver_id === user.id && profile?.read_receipts_enabled !== false) {
          supabase.from('messages').update({ read: true }).eq('id', m.id)
        }
        if (m.sender_id !== user.id) {
          setPartnerTyping(false)
          if (!stickToBottomRef.current) setNewCount((c) => c + 1)
          if (!mutedRef.current) playTone(profile?.notify_message_tone || 'default')
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new
        if (!isThisThread(m)) return
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const id = payload.old?.id
        if (id) setMessages((prev) => prev.filter((x) => x.id !== id))
      })
      .subscribe()

    const names = [user.id, partnerId].sort().join('-')
    const typingChannel = supabase
      .channel(`typing-${names}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.from !== partnerId) return
        setPartnerTyping(true)
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = setTimeout(() => setPartnerTyping(false), 3000)
      })
      .subscribe((status) => { typingReadyRef.current = status === 'SUBSCRIBED' })
    typingChannelRef.current = typingChannel

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(typingChannel)
      typingChannelRef.current = null
      typingReadyRef.current = false
      clearTimeout(typingTimerRef.current)
      setPartnerTyping(false)
    }
  }, [user, partnerId])

  function sendTyping(value) {
    if (!value || !typingReadyRef.current || !typingChannelRef.current) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < 2000) return
    lastTypingSentRef.current = now
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { from: user.id } })
  }

  const threadFilter = () => `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`

  async function loadExtras(ids) {
    if (ids.length === 0) return
    const { data: allReactions } = await supabase.from('message_reactions').select('*').in('message_id', ids)
    setReactions((prev) => {
      const next = { ...prev }
      for (const r of allReactions ?? []) {
        const list = next[r.message_id] ?? []
        if (!list.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) next[r.message_id] = [...list, { emoji: r.emoji, user_id: r.user_id }]
      }
      return next
    })
    const { data: starredRows } = await supabase.from('starred_messages').select('message_id').eq('user_id', user.id).in('message_id', ids)
    setStarred((prev) => {
      const next = new Set(prev)
      for (const s of starredRows ?? []) next.add(s.message_id)
      return next
    })
  }

  // Only the latest messages load first; older ones load when asked.
  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(threadFilter())
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    const page = (data ?? []).slice().reverse()
    setHasMore((data ?? []).length === PAGE_SIZE)

    const now = new Date()
    const active = page.filter((m) => !m.expire_at || new Date(m.expire_at) > now)
    const expired = page.filter((m) => m.expire_at && new Date(m.expire_at) <= now)
    if (expired.length > 0) {
      await supabase.from('messages').delete().in('id', expired.map((m) => m.id))
    }
    setMessages(active)
    await loadExtras(active.map((m) => m.id))

    const unreadIds = active.filter((m) => m.receiver_id === user.id && !m.read).map((m) => m.id)
    if (unreadIds.length > 0) await supabase.from('messages').update({ read: true }).in('id', unreadIds)
  }

  async function loadOlder() {
    if (loadingOlder || messages.length === 0) return
    setLoadingOlder(true)
    const oldest = messages[0]
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(threadFilter())
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    const older = (data ?? []).slice().reverse()
    setHasMore((data ?? []).length === PAGE_SIZE)
    const now = new Date()
    const active = older.filter((m) => !m.expire_at || new Date(m.expire_at) > now)
    if (scrollRef.current) prevHeightRef.current = scrollRef.current.scrollHeight
    setMessages((prev) => [...active.filter((m) => !prev.some((x) => x.id === m.id)), ...prev])
    await loadExtras(active.map((m) => m.id))
    setLoadingOlder(false)
  }

  function computeExpiry() {
    return myChatSettings.disappearing_enabled ? new Date(Date.now() + myChatSettings.disappearing_seconds * 1000).toISOString() : null
  }

  // Saves a message and shows it straight away, without waiting for the live update.
  async function sendRow(row) {
    const { data, error } = await supabase.from('messages').insert(row).select().single()
    if (data) addMessage(data)
    return { error }
  }

  async function handleReact(messageId, emoji) {
    await supabase.from('message_reactions').upsert({ message_id: messageId, user_id: user.id, emoji })
    setReactions((prev) => {
      const others = (prev[messageId] ?? []).filter((r) => r.user_id !== user.id)
      return { ...prev, [messageId]: [...others, { emoji, user_id: user.id }] }
    })
  }

  async function handleRemoveReaction(messageId) {
    await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', user.id)
    setReactions((prev) => ({ ...prev, [messageId]: (prev[messageId] ?? []).filter((r) => r.user_id !== user.id) }))
  }

  // Delete for everyone: the message stays as "This message was deleted".
  async function handleDeleteMessage(messageId) {
    const stamp = new Date().toISOString()
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: stamp, content: null, media_url: null, media_type: null })
      .eq('id', messageId)
    if (error) {
      // The new columns are not set up yet: fall back to removing the message.
      await supabase.from('messages').delete().eq('id', messageId)
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      return
    }
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deleted_at: stamp, content: null, media_url: null, media_type: null } : m)))
  }

  async function handleStar(messageId, isStarred) {
    if (isStarred) {
      await supabase.from('starred_messages').delete().eq('user_id', user.id).eq('message_id', messageId)
      setStarred((prev) => { const next = new Set(prev); next.delete(messageId); return next })
    } else {
      await supabase.from('starred_messages').insert({ user_id: user.id, message_id: messageId })
      setStarred((prev) => new Set(prev).add(messageId))
    }
  }

  function startEdit(m) {
    setReplyTo(null)
    setEditing(m)
    setText(m.content || '')
    setShowEmojis(false)
  }

  function cancelEdit() {
    setEditing(null)
        try {
      setText(localStorage.getItem(draftKey) || '')
    } catch {
      setText('')
    }
  }

  async function handleSend() {
    if (!text.trim() || sending || isBlocked) return
    setSending(true)
    setSendError('')
    const content = text
    setShowEmojis(false)

    if (editing) {
      const target = editing
      const stamp = new Date().toISOString()
      const { error } = await supabase.from('messages').update({ content: content.trim(), edited_at: stamp }).eq('id', target.id)
      setSending(false)
      if (error) {
        setSendError("Couldn't save the change. Try again.")
        return
      }
      setMessages((prev) => prev.map((m) => (m.id === target.id ? { ...m, content: content.trim(), edited_at: stamp } : m)))
      setEditing(null)
      try {
        setText(localStorage.getItem(draftKey) || '')
      } catch {
        setText('')
      }
      return
    }

    const replyId = replyTo?.id ?? null
    const previousReply = replyTo
    setText('')
    setReplyTo(null)
    try {
      localStorage.removeItem(draftKey)
    } catch {
      // ignore
    }
    const { error } = await sendRow({ sender_id: user.id, receiver_id: partnerId, content, reply_to_id: replyId, expire_at: computeExpiry() })
    setSending(false)
    if (error) {
      // Put the text back so nothing is lost.
      setText(content)
      setReplyTo(previousReply)
      setSendError('Message not sent. Check your connection and tap send again.')
    }
  }

  // Camera, gallery or document picked: show the preview screen first (with a caption box).
  function handlePicked(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    setShowAttach(false)
    if (files.length === 0 || isBlocked) return
    const items = []
    for (const file of files) {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setSendError(`${file.name} is bigger than ${MAX_UPLOAD_MB} MB.`)
        continue
      }
      const kind = kindOfFile(file)
      items.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        kind,
        url: kind === 'file' ? null : URL.createObjectURL(file),
      })
    }
    if (items.length > 0) {
      setSendError('')
      setPreviewItems(items)
    }
  }

  function cancelPreview() {
    for (const it of previewItems || []) if (it.url) URL.revokeObjectURL(it.url)
    setPreviewItems(null)
  }

  // "Send" on the preview screen: the bubbles appear at once, then upload one by one in order.
  function confirmPreview(list) {
    setPreviewItems(null)
    const queued = list.map((it) => ({
      tempId: `tmp-${it.id}`,
      kind: it.kind,
      file: it.file,
      name: it.file.name,
      size: it.file.size,
      previewUrl: it.url,
      caption: (it.caption || '').trim(),
      status: 'sending',
    }))
    setPending((prev) => [...prev, ...queued])
    ;(async () => {
      for (const q of queued) {
        // eslint-disable-next-line no-await-in-loop
        await uploadAndSend(q)
      }
    })()
  }

  async function uploadAndSend(item) {
    setPending((prev) => prev.map((x) => (x.tempId === item.tempId ? { ...x, status: 'sending' } : x)))
    const safeName = String(item.name || 'file').replace(/[^\w.\-]+/g, '_')
    const path = `${user.id}/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from('chat-media').upload(path, item.file, { contentType: item.file.type || undefined })
    if (error) {
      setPending((prev) => prev.map((x) => (x.tempId === item.tempId ? { ...x, status: 'failed' } : x)))
      return
    }
    const { data } = supabase.storage.from('chat-media').getPublicUrl(path)
    const { error: sendErr } = await sendRow({
      sender_id: user.id,
      receiver_id: partnerId,
      media_url: data.publicUrl,
      media_type: item.kind,
      content: item.kind === 'file' ? item.name : item.caption || null,
      expire_at: computeExpiry(),
    })
    if (sendErr) {
      setSendError(`Couldn't send. (${sendErr.message || 'unknown error'})`)
      setPending((prev) => prev.map((x) => (x.tempId === item.tempId ? { ...x, status: 'failed' } : x)))
      return
    }
    setPending((prev) => prev.filter((x) => x.tempId !== item.tempId))
    if (item.previewUrl) setTimeout(() => URL.revokeObjectURL(item.previewUrl), 5000)
  }

  function retryPending(tempId) {
    const item = pending.find((x) => x.tempId === tempId)
    if (item) {
      setSendError('')
      uploadAndSend(item)
    }
  }

  function discardPending(tempId) {
    const item = pending.find((x) => x.tempId === tempId)
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    setPending((prev) => prev.filter((x) => x.tempId !== tempId))
  }

  // Voice notes: a running timer, and the microphone is released when you stop or cancel.
  useEffect(() => {
    if (!recording) return undefined
    setRecordSeconds(0)
    const timer = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  // Picks a sound format this phone can record and play back.
  function pickAudioType() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || ''
  }

  async function startRecording() {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      alert("The microphone is turned off for Schoolink. Open your phone's Settings → Apps → Schoolink → Permissions → Microphone and allow it, then try again.")
      return
    }
    try {
      streamRef.current = stream
      const type = pickAudioType()
      const recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream)
      chunksRef.current = []
      cancelRecordingRef.current = false
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = handleRecordingStop
      mediaRecorderRef.current = recorder
      recorder.start(250)
      recordStartRef.current = Date.now()
      setRecording(true)
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      setSendError("This phone couldn't start a voice recording. Try again.")
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  function cancelRecording() {
    cancelRecordingRef.current = true
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function handleRecordingStop() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (cancelRecordingRef.current) return
    const base = (mediaRecorderRef.current?.mimeType || 'audio/webm').split(';')[0]
    const ext = base.includes('mp4') ? 'm4a' : base.includes('ogg') ? 'ogg' : 'webm'
    const blob = new Blob(chunksRef.current, { type: base })
    if (Date.now() - recordStartRef.current < 700 || blob.size === 0) {
      setSendError('That was too short. Tap the microphone and speak a little longer.')
      return
    }
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: base })
    const item = { tempId: `tmp-${Date.now()}`, kind: 'audio', file, name: file.name, size: file.size, previewUrl: null, caption: '', status: 'sending' }
    setPending((prev) => [...prev, item])
    await uploadAndSend(item)
  }

  async function handleForwardSend(recipientId) {
    if (!forwarding) return
    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: recipientId, content: forwarding.content, media_url: forwarding.media_url, media_type: forwarding.media_type })
    setForwarding(null)
    navigate(`/chats/${recipientId}`)
  }

  return (
    <div className="app-shell">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        {searchOpen ? (
          <>
            <button onClick={closeSearch}><X size={18} className="text-gray-400" /></button>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this chat…"
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm outline-brand-purple"
            />
            <span className="text-xs text-gray-400 shrink-0 w-10 text-center">{searchQuery.trim() ? (matches.length > 0 ? `${matchIndex + 1}/${matches.length}` : '0/0') : ''}</span>
            <button onClick={goToPrevMatch} disabled={matches.length === 0}><ChevronUp size={18} className={matches.length ? 'text-brand-purple' : 'text-gray-300'} /></button>
            <button onClick={goToNextMatch} disabled={matches.length === 0}><ChevronDown size={18} className={matches.length ? 'text-brand-purple' : 'text-gray-300'} /></button>
          </>
        ) : (
          <>
            <BackHeader />
            <button onClick={() => partner?.avatar_url && setViewingAvatar(partner.avatar_url)} className="relative -ml-2">
              {partner?.avatar_url ? <img src={partner.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center text-lg">🙂</span>}
              {isOnline ? <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" /> : null}
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate flex items-center gap-1"><span className="truncate">{partner?.full_name || 'Schoolink member'}</span><VerifiedBadge userId={partnerId} size={14} /></p>
              <p className={`text-xs truncate ${partnerTyping ? 'text-brand-purple font-medium' : 'text-gray-400'}`}>{partnerTyping ? 'typing…' : isOnline ? 'Online' : partner?.role || ''}</p>
            </div>
            <button onClick={() => setSearchOpen(true)}><Search size={18} className="text-gray-400" /></button>
            <button onClick={() => navigate(`/chats/${partnerId}/options`)}><MoreVertical size={18} className="text-gray-400" /></button>
          </>
        )}
      </div>

      {isBlocked ? <div className="bg-red-50 text-red-500 text-xs text-center py-2 px-4">You've blocked this person. Unblock to send messages.</div> : null}
      {myChatSettings.disappearing_enabled ? <div className="bg-brand-light text-brand-purple text-[11px] text-center py-1.5 px-4">Disappearing messages are on</div> : null}

      <div ref={scrollRef} onScroll={handleScroll} className="screen-scroll px-4 py-3 flex flex-col chat-surface" style={wallpapers.find((w) => w.key === (profile?.chat_wallpaper || 'default'))?.style}>
        {hasMore ? (
          <button onClick={loadOlder} disabled={loadingOlder} className="self-center text-xs text-brand-purple bg-white/80 border border-gray-100 rounded-full px-4 py-1.5 disabled:opacity-60">
            {loadingOlder ? 'Loading…' : 'Load earlier messages'}
          </button>
        ) : null}
        {messages.map((m, i) => {
          const showDay = i === 0 || !sameDay(new Date(messages[i - 1].created_at), new Date(m.created_at))
          return (
            <div key={m.id} ref={(el) => (messageRefs.current[m.id] = el)} className="flex flex-col gap-3">
              {showDay ? (
                <span className="self-center text-[11px] text-gray-500 bg-white/80 border border-gray-100 rounded-full px-3 py-0.5">{dayLabel(m.created_at)}</span>
              ) : null}
              <MessageBubble m={m} isMine={m.sender_id === user.id} reactions={reactions} starred={starred} currentUserId={user.id} onReact={handleReact} onRemoveReaction={handleRemoveReaction} onReply={setReplyTo} onStar={handleStar} onForward={setForwarding} onDelete={handleDeleteMessage} onEdit={startEdit} onJumpTo={jumpTo} onOpenImage={setLightboxUrl} allMessages={messages} highlightQuery={searchQuery.trim()} isCurrentMatch={matches[matchIndex]?.id === m.id} autoDownloadMedia={profile?.auto_download_media} />
            </div>
          )
        })}
        {pending.map((item) => (
          <PendingBubble key={item.tempId} item={item} onRetry={retryPending} onDiscard={discardPending} />
        ))}
        <div ref={bottomRef} />
      </div>

      {!atBottom ? (
        <button
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to latest"
          className="absolute bottom-24 right-4 w-10 h-10 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center"
        >
          <ChevronDown size={20} className="text-brand-purple" />
          {newCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-purple text-white text-[10px] font-semibold flex items-center justify-center">{newCount > 9 ? '9+' : newCount}</span>
          ) : null}
        </button>
      ) : null}

      {sendError ? <div className="bg-red-50 text-red-500 text-xs text-center py-2 px-4">{sendError}</div> : null}

      {editing ? (
        <div className="flex items-center justify-between px-4 py-2 bg-brand-light border-t border-gray-100">
          <p className="text-xs text-brand-purple truncate flex items-center gap-1"><Pencil size={12} /> Editing message</p>
          <button onClick={cancelEdit}><X size={14} className="text-gray-400" /></button>
        </div>
      ) : null}

      {replyTo ? (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500 truncate">Replying to: {previewText(replyTo)}</p>
          <button onClick={() => setReplyTo(null)}><X size={14} className="text-gray-400" /></button>
        </div>
      ) : null}

      {showEmojis ? (
        <div className="px-4 py-2 border-t border-gray-100 bg-white max-h-36 overflow-y-auto grid grid-cols-9 gap-1">
          {ALL_EMOJIS.map((emoji, i) => (
            <button key={`${emoji}-${i}`} onClick={() => updateText(text + emoji)} className="text-xl leading-none p-1">{emoji}</button>
          ))}
        </div>
      ) : null}

      <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple onChange={handlePicked} className="hidden" />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePicked} className="hidden" />
      <input ref={docInputRef} type="file" multiple onChange={handlePicked} className="hidden" />

      {showAttach ? (
        <>
          <div onClick={() => setShowAttach(false)} className="fixed inset-0 z-10" />
          <div className="absolute bottom-20 left-4 right-4 z-20 bg-white border border-gray-100 rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-4">
            <button onClick={() => docInputRef.current?.click()} className="flex flex-col items-center gap-1.5">
              <span className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center"><FileText size={20} className="text-white" /></span>
              <span className="text-xs text-gray-600">Document</span>
            </button>
            <button onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-1.5">
              <span className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center"><Camera size={20} className="text-white" /></span>
              <span className="text-xs text-gray-600">Camera</span>
            </button>
            <button onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center gap-1.5">
              <span className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center"><ImageIcon size={20} className="text-white" /></span>
              <span className="text-xs text-gray-600">Gallery</span>
            </button>
          </div>
        </>
      ) : null}

      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
        {recording ? (
          <>
            <button onClick={cancelRecording} aria-label="Cancel recording" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><Trash2 size={16} className="text-red-400" /></button>
            <div className="flex-1 flex items-center gap-2 border border-red-200 bg-red-50 rounded-full px-4 py-2.5 text-sm text-red-500">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Recording {formatSeconds(recordSeconds)}
            </div>
            <button onClick={stopRecording} aria-label="Send voice message" className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0"><Send size={16} className="text-white" /></button>
          </>
        ) : (
          <>
            <button onClick={() => setShowEmojis((s) => !s)} aria-label="Emoji"><Smile size={18} className={showEmojis ? 'text-brand-purple' : 'text-gray-500'} /></button>
            <input
              value={text}
              onChange={(e) => updateText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && profile?.chat_enter_to_send !== false && handleSend()}
              placeholder={isBlocked ? 'Unblock to send a message' : editing ? 'Edit your message…' : 'Message…'}
              disabled={isBlocked}
              className="flex-1 min-w-0 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-brand-purple disabled:opacity-60"
            />
            {!text.trim() && !editing ? (
              <>
                <button onClick={() => setShowAttach((v) => !v)} disabled={isBlocked} aria-label="Attach" className="shrink-0 disabled:opacity-40"><Paperclip size={19} className={showAttach ? 'text-brand-purple' : 'text-gray-500'} /></button>
                <button onClick={() => cameraInputRef.current?.click()} disabled={isBlocked} aria-label="Camera" className="shrink-0 disabled:opacity-40"><Camera size={19} className="text-gray-500" /></button>
              </>
            ) : null}
            {text.trim() || editing ? (
              <button onClick={handleSend} disabled={sending || isBlocked} className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-60">
                {editing ? <Check size={18} className="text-white" /> : <Send size={16} className="text-white" />}
              </button>
            ) : (
              <button onClick={startRecording} disabled={isBlocked} aria-label="Record voice message" className="w-10 h-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 disabled:opacity-60">
                <Mic size={18} className="text-white" />
              </button>
            )}
          </>
        )}
      </div>

      {lightboxUrl ? (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <button onClick={() => setLightboxUrl(null)} aria-label="Close" className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"><X size={20} className="text-white" /></button>
            <a href={lightboxUrl} target="_blank" rel="noreferrer" className="text-xs text-white/80 underline">Open original</a>
          </div>
          <div className="flex-1 min-h-0"><ZoomImage src={lightboxUrl} /></div>
        </div>
      ) : null}

      {previewItems ? <MediaPreview items={previewItems} onSend={confirmPreview} onCancel={cancelPreview} /> : null}
      {forwarding ? <ForwardPicker onClose={() => setForwarding(null)} onSend={handleForwardSend} /> : null}
      {viewingAvatar ? <AvatarViewer imageUrl={viewingAvatar} onClose={() => setViewingAvatar(null)} /> : null}
    </div>
  )
            }
