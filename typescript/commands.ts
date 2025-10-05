// Get list of URI schemes we can handle
export function core_get_uri_schemes () {

}

// Get version of the Mopidy core API
export function core_get_version () {

}

// Get the track history.
//
// The timestamps are milliseconds since epoch.
//
// :returns: the track history
// :rtype: list of (timestamp, :class:`mopidy.models.Ref`) tuples
export function core_history_get_history () {

}

// Get the number of tracks in the history.
//
// :returns: the history length
// :rtype: int
export function core_history_get_length () {

}

// Browse directories and tracks at the given ``uri``.
//
// ``uri`` is a string which represents some directory belonging to a
// backend. To get the intial root directories for backends pass
// :class:`None` as the URI.
//
// Returns a list of :class:`mopidy.models.Ref` objects for the
// directories and tracks at the given ``uri``.
//
// The :class:`~mopidy.models.Ref` objects representing tracks keep the
// track's original URI. A matching pair of objects can look like this::
//
//     Track(uri='dummy:/foo.mp3', name='foo', artists=..., album=...)
//     Ref.track(uri='dummy:/foo.mp3', name='foo')
//
//     The :class:`~mopidy.models.Ref` objects representing directories have
//     backend specific URIs. These are opaque values, so no one but the
//     backend that created them should try and derive any meaning from them.
//     The only valid exception to this is checking the scheme, as it is used
//     to route browse requests to the correct backend.
//
//     For example, the dummy library's ``/bar`` directory could be returned
//     like this::
//
//         Ref.directory(uri='dummy:directory:/bar', name='bar')
//
//         :param string uri: URI to browse
//         :rtype: list of :class:`mopidy.models.Ref`
//
//         .. versionadded:: 0.18
export function core_library_browse (uri: string) {

}

// List distinct values for a given field from the library.
//
// This has mainly been added to support the list commands the MPD
// protocol supports in a more sane fashion. Other frontends are not
// recommended to use this method.
//
// :param string field: Any one of ``uri``, ``track_name``, ``album``,
// ``artist``, ``albumartist``, ``composer``, ``performer``,
// ``track_no``, ``genre``, ``date``, ``comment``, ``disc_no``,
// ``musicbrainz_albumid``, ``musicbrainz_artistid``, or
// ``musicbrainz_trackid``.
// :param dict query: Query to use for limiting results, see
// :meth:`search` for details about the query format.
// :rtype: set of values corresponding to the requested field type.
//
// .. versionadded:: 1.0
export function core_library_get_distinct (field, query = null) {

}

// Lookup the images for the given URIs
//
// Backends can use this to return image URIs for any URI they know about
// be it tracks, albums, playlists. The lookup result is a dictionary
// mapping the provided URIs to lists of images.
//
// Unknown URIs or URIs the corresponding backend couldn't find anything
// for will simply return an empty list for that URI.
//
// :param uris: list of URIs to find images for
// :type uris: list of string
// :rtype: {uri: tuple of :class:`mopidy.models.Image`}

//
// .. versionadded:: 1.0
export function core_library_get_images (uris) {

}

// Lookup the given URIs.
//
// If the URI expands to multiple tracks, the returned list will contain
// them all.
//
// :param uris: track URIs
// :type uris: list of string
// :rtype: {uri: list of :class:`mopidy.models.Track`}

export function core_library_lookup (uris) {

}

// Refresh library. Limit to URI and below if an URI is given.
//
// :param uri: directory or track URI
// :type uri: string
export function core_library_refresh (uri = null) {

}

// Search the library for tracks where ``field`` contains ``values``.
//
// ``field`` can be one of ``uri``, ``track_name``, ``album``, ``artist``,
// ``albumartist``, ``composer``, ``performer``, ``track_no``, ``genre``,
// ``date``, ``comment``, ``disc_no``, ``musicbrainz_albumid``,
// ``musicbrainz_artistid``, ``musicbrainz_trackid`` or ``any``.
//
// If ``uris`` is given, the search is limited to results from within the
// URI roots. For example passing ``uris=['file:']`` will limit the search
// to the local backend.
//
// Examples::
//
//     # Returns results matching 'a' in any backend
//     search({'any': ['a']}
//     )
//
//         # Returns results matching artist 'xyz' in any backend
//         search({'artist': ['xyz']}
//         )
//
//             # Returns results matching 'a' and 'b' and artist 'xyz' in any
//             # backend
//             search({'any': ['a', 'b'], 'artist': ['xyz']}
//             )
//
//                 # Returns results matching 'a' if within the given URI roots
//                 # \"file:///media/music\" and \"spotify:\"
//                 search({'any': ['a']}
//                 uris=['file:///media/music', 'spotify:'])
//
//                     # Returns results matching artist 'xyz' and 'abc' in any backend
//                     search({'artist': ['xyz', 'abc']}
//                     )
//
//                     :param query: one or more queries to search for
//                     :type query: dict
//                     :param uris: zero or more URI roots to limit the search to
//                     :type uris: list of string or :class:`None`
//                     :param exact: if the search should use exact matching
//                     :type exact: :class:`bool`
//                     :rtype: list of :class:`mopidy.models.SearchResult`
//
//                     .. versionadded:: 1.0
//                     The ``exact`` keyword argument.
export function core_library_search (query, uris = null, exact = null) {

}

// Get mute state.
//
// :class:`True` if muted, :class:`False` unmuted, :class:`None` if
// unknown.
export function core_mixer_get_mute () {

}

// Get the volume.
//
// Integer in range [0..100] or :class:`None` if unknown.
//
// The volume scale is linear.
export function core_mixer_get_volume () {

}

// Set mute state.
//
// :class:`True` to mute, :class:`False` to unmute.
//
// Returns :class:`True` if call is successful, otherwise :class:`False`.
export function core_mixer_set_mute (mute) {

}

// Set the volume.
//
// The volume is defined as an integer in range [0..100].
//
// The volume scale is linear.
//
// Returns :class:`True` if call is successful, otherwise :class:`False`.
export function core_mixer_set_volume (volume) {

}

// Get the currently playing or selected track.
//
// Returns a :class:`mopidy.models.TlTrack` or :class:`None`.
export function core_playback_get_current_tl_track () {

}

// Get the currently playing or selected TLID.
//
// Extracted from :meth:`get_current_tl_track` for convenience.
//
// Returns a :class:`int` or :class:`None`.
//
// .. versionadded:: 1.1
export function core_playback_get_current_tlid () {

}

// Get the currently playing or selected track.
//
// Extracted from :meth:`get_current_tl_track` for convenience.
//
// Returns a :class:`mopidy.models.Track` or :class:`None`.
export function core_playback_get_current_track () {

}

// Get The playback state.
export function core_playback_get_state () {

}

// Get the current stream title or :class:`None`.
export function core_playback_get_stream_title () {

}

// Get time position in milliseconds.
export function core_playback_get_time_position () {

}

// Change to the next track.
//
// The current playback state will be kept. If it was playing, playing
// will continue. If it was paused, it will still be paused, etc.
export function core_playback_next () {

}

// Pause playback.
export function core_playback_pause () {

}

// Play the given track, or if the given tl_track and tlid is
// :class:`None`, play the currently active track.
//
// Note that the track **must** already be in the tracklist.
//
// .. deprecated:: 3.0
// The ``tl_track`` argument. Use ``tlid`` instead.
//
// :param tl_track: track to play
// :type tl_track: :class:`mopidy.models.TlTrack` or :class:`None`
// :param tlid: TLID of the track to play
// :type tlid: :class:`int` or :class:`None`
export function core_playback_play (tl_track = null, tlid = null) {

}

// Change to the previous track.
//
// The current playback state will be kept. If it was playing, playing
// will continue. If it was paused, it will still be paused, etc.
export function core_playback_previous () {

}

// If paused, resume playing the current track.
export function core_playback_resume () {

}

// Seeks to time position given in milliseconds.
//
// :param time_position: time position in milliseconds
// :type time_position: int
// :rtype: :class:`True` if successful, else :class:`False`
export function core_playback_seek (time_position) {

}

// Set the playback state.
//
// Must be :attr:`PLAYING`, :attr:`PAUSED`, or :attr:`STOPPED`.
//
// Possible states and transitions:
//
// .. digraph:: state_transitions
//
//     \"STOPPED\" -> \"PLAYING\" [ label=\"play\" ]
//     \"STOPPED\" -> \"PAUSED\" [ label=\"pause\" ]
//     \"PLAYING\" -> \"STOPPED\" [ label=\"stop\" ]
//     \"PLAYING\" -> \"PAUSED\" [ label=\"pause\" ]
//     \"PLAYING\" -> \"PLAYING\" [ label=\"play\" ]
//     \"PAUSED\" -> \"PLAYING\" [ label=\"resume\" ]
//     \"PAUSED\" -> \"STOPPED\" [ label=\"stop\" ]
export function core_playback_set_state (new_state) {

}

// Stop playing.
export function core_playback_stop () {

}

// Get a list of the currently available playlists.
//
// Returns a list of :class:`~mopidy.models.Ref` objects referring to the
// playlists. In other words, no information about the playlists' content
// is given.
//
// :rtype: list of :class:`mopidy.models.Ref`
//
// .. versionadded:: 1.0
export function core_playlists_as_list () {

}

// Create a new playlist.
//
// If ``uri_scheme`` matches an URI scheme handled by a current backend,
// that backend is asked to create the playlist. If ``uri_scheme`` is
// :class:`None` or doesn't match a current backend, the first backend is
// asked to create the playlist.
//
// All new playlists must be created by calling this method, and **not**
// by creating new instances of :class:`mopidy.models.Playlist`.
//
// :param name: name of the new playlist
// :type name: string
// :param uri_scheme: use the backend matching the URI scheme
// :type uri_scheme: string
// :rtype: :class:`mopidy.models.Playlist` or :class:`None`
export function core_playlists_create (name, uri_scheme = null) {

}

// Delete playlist identified by the URI.
//
// If the URI doesn't match the URI schemes handled by the current
// backends, nothing happens.
//
// Returns :class:`True` if deleted, :class:`False` otherwise.
//
// :param uri: URI of the playlist to delete
// :type uri: string
// :rtype: :class:`bool`
//
// .. versionchanged:: 2.2
// Return type defined.
export function core_playlists_delete (uri) {

}

// Get the items in a playlist specified by ``uri``.
//
// Returns a list of :class:`~mopidy.models.Ref` objects referring to the
// playlist's items.
//
// If a playlist with the given ``uri`` doesn't exist, it returns
// :class:`None`.
//
// :rtype: list of :class:`mopidy.models.Ref`, or :class:`None`
//
// .. versionadded:: 1.0
export function core_playlists_get_items (uri) {

}

// Get the list of URI schemes that support playlists.
//
// :rtype: list of string
//
// .. versionadded:: 2.0
export function core_playlists_get_uri_schemes () {

}

// Lookup playlist with given URI in both the set of playlists and in any
// other playlist sources. Returns :class:`None` if not found.
//
// :param uri: playlist URI
// :type uri: string
// :rtype: :class:`mopidy.models.Playlist` or :class:`None`
export function core_playlists_lookup (uri) {

}

// Refresh the playlists in :attr:`playlists`.
//
// If ``uri_scheme`` is :class:`None`, all backends are asked to refresh.
// If ``uri_scheme`` is an URI scheme handled by a backend, only that
// backend is asked to refresh. If ``uri_scheme`` doesn't match any
// current backend, nothing happens.
//
// :param uri_scheme: limit to the backend matching the URI scheme
// :type uri_scheme: string
export function core_playlists_refresh (uri_scheme = null) {

}

// Save the playlist.
//
// For a playlist to be saveable, it must have the ``uri`` attribute set.
// You must not set the ``uri`` atribute yourself, but use playlist
// objects returned by :meth:`create` or retrieved from :attr:`playlists`,
// which will always give you saveable playlists.
//
// The method returns the saved playlist. The return playlist may differ
// from the saved playlist. E.g. if the playlist name was changed, the
// returned playlist may have a different URI. The caller of this method
// must throw away the playlist sent to this method, and use the
// returned playlist instead.
//
// If the playlist's URI isn't set or doesn't match the URI scheme of a
// current backend, nothing is done and :class:`None` is returned.
//
// :param playlist: the playlist
// :type playlist: :class:`mopidy.models.Playlist`
// :rtype: :class:`mopidy.models.Playlist` or :class:`None`
export function core_playlists_save (playlist) {

}

// Add tracks to the tracklist.
//
// If ``uris`` is given instead of ``tracks``, the URIs are
// looked up in the library and the resulting tracks are added to the
// tracklist.
//
// If ``at_position`` is given, the tracks are inserted at the given
// position in the tracklist. If ``at_position`` is not given, the tracks
// are appended to the end of the tracklist.
//
// Triggers the :meth:`mopidy.core.CoreListener.tracklist_changed` event.
//
// :param tracks: tracks to add
// :type tracks: list of :class:`mopidy.models.Track` or :class:`None`
// :param at_position: position in tracklist to add tracks
// :type at_position: int or :class:`None`
// :param uris: list of URIs for tracks to add
// :type uris: list of string or :class:`None`
// :rtype: list of :class:`mopidy.models.TlTrack`
//
// .. versionadded:: 1.0
// The ``uris`` argument.
//
// .. deprecated:: 1.0
// The ``tracks`` argument. Use ``uris``.
export function core_tracklist_add (tracks?,at_position?, uris? ) {

}

// Clear the tracklist.
//
// Triggers the :meth:`mopidy.core.CoreListener.tracklist_changed` event.
export function core_tracklist_clear () {

}

// The track that will be played after the given track.
//
// Not necessarily the same track as :meth:`next_track`.
//
// .. deprecated:: 3.0
// Use :meth:`get_eot_tlid` instead.
//
// :param tl_track: the reference track
// :type tl_track: :class:`mopidy.models.TlTrack` or :class:`None`
// :rtype: :class:`mopidy.models.TlTrack` or :class:`None`
export function core_tracklist_eot_track (tl_track) {

}

// Filter the tracklist by the given criteria.
//
// Each rule in the criteria consists of a model field and a list of
// values to compare it against. If the model field matches any of the
// values, it may be returned.
//
// Only tracks that match all the given criteria are returned.
//
// Examples::
//
//     # Returns tracks with TLIDs 1, 2, 3, or 4 (tracklist ID)
//     filter({'tlid': [1, 2, 3, 4]}
//     )
//
//         # Returns track with URIs 'xyz' or 'abc'
//         filter({'uri': ['xyz', 'abc']}
//         )
//
//             # Returns track with a matching TLIDs (1, 3 or 6) and a
//             # matching URI ('xyz' or 'abc')
//             filter({'tlid': [1, 3, 6], 'uri': ['xyz', 'abc']}
//             )
//
//             :param criteria: one or more rules to match by
//             :type criteria: dict, of (string, list) pairs
//             :rtype: list of :class:`mopidy.models.TlTrack`
export function core_tracklist_filter (criteria) {

}

// Get consume mode.
//
// :class:`True`
// Tracks are removed from the tracklist when they have been played.
// :class:`False`
// Tracks are not removed from the tracklist.
export function core_tracklist_get_consume () {

}

// The TLID of the track that will be played after the current track.
//
// Not necessarily the same TLID as returned by :meth:`get_next_tlid`.
//
// :rtype: :class:`int` or :class:`None`
//
// .. versionadded:: 1.1
export function core_tracklist_get_eot_tlid () {

}

// Get length of the tracklist.
export function core_tracklist_get_length () {

}

// The tlid of the track that will be played if calling
// :meth:`mopidy.core.PlaybackController.next()`.
//
// For normal playback this is the next track in the tracklist. If repeat
// is enabled the next track can loop around the tracklist. When random is
// enabled this should be a random track, all tracks should be played once
// before the tracklist repeats.
//
// :rtype: :class:`int` or :class:`None`
//
// .. versionadded:: 1.1
export function core_tracklist_get_next_tlid () {

}

// Returns the TLID of the track that will be played if calling
// :meth:`mopidy.core.PlaybackController.previous()`.
//
// For normal playback this is the previous track in the tracklist. If
// random and/or consume is enabled it should return the current track
// instead.
//
// :rtype: :class:`int` or :class:`None`
//
// .. versionadded:: 1.1
export function core_tracklist_get_previous_tlid () {

}

// Get random mode.
//
// :class:`True`
// Tracks are selected at random from the tracklist.
// :class:`False`
// Tracks are played in the order of the tracklist.
export function core_tracklist_get_random () {

}

// Get repeat mode.
//
// :class:`True`
// The tracklist is played repeatedly.
// :class:`False`
// The tracklist is played once.
export function core_tracklist_get_repeat () {

}

// Get single mode.
//
// :class:`True`
// Playback is stopped after current song, unless in ``repeat`` mode.
// :class:`False`
// Playback continues after current song.
export function core_tracklist_get_single () {

}

// Get tracklist as list of :class:`mopidy.models.TlTrack`.
export function core_tracklist_get_tl_tracks () {

}

// Get tracklist as list of :class:`mopidy.models.Track`.
export function core_tracklist_get_tracks () {

}

// Get the tracklist version.
//
// Integer which is increased every time the tracklist is changed. Is not
// reset before Mopidy is restarted.
export function core_tracklist_get_version () {

}

// The position of the given track in the tracklist.
//
// If neither *tl_track* or *tlid* is given we return the index of
// the currently playing track.
//
// :param tl_track: the track to find the index of
// :type tl_track: :class:`mopidy.models.TlTrack` or :class:`None`
// :param tlid: TLID of the track to find the index of
// :type tlid: :class:`int` or :class:`None`
// :rtype: :class:`int` or :class:`None`
//
// .. versionadded:: 1.1
// The *tlid* parameter
export function core_tracklist_index (tl_track?, tlid?) {

}

// Move the tracks in the slice ``[start:end]`` to ``to_position``.
//
// Triggers the :meth:`mopidy.core.CoreListener.tracklist_changed` event.
//
// :param start: position of first track to move
// :type start: int
// :param end: position after last track to move
// :type end: int
// :param to_position: new position for the tracks
// :type to_position: int
export function core_tracklist_move (start, end, to_position) {

}

// The track that will be played if calling
// :meth:`mopidy.core.PlaybackController.next()`.
//
// For normal playback this is the next track in the tracklist. If repeat
// is enabled the next track can loop around the tracklist. When random is
// enabled this should be a random track, all tracks should be played once
// before the tracklist repeats.
//
// .. deprecated:: 3.0
// Use :meth:`get_next_tlid` instead.
//
// :param tl_track: the reference track
// :type tl_track: :class:`mopidy.models.TlTrack` or :class:`None`
// :rtype: :class:`mopidy.models.TlTrack` or :class:`None`
export function core_tracklist_next_track (tl_track) {

}

// Returns the track that will be played if calling
// :meth:`mopidy.core.PlaybackController.previous()`.
//
// For normal playback this is the previous track in the tracklist. If
// random and/or consume is enabled it should return the current track
// instead.
//
// .. deprecated:: 3.0
// Use :meth:`get_previous_tlid` instead.
//
// :param tl_track: the reference track
// :type tl_track: :class:`mopidy.models.TlTrack` or :class:`None`
// :rtype: :class:`mopidy.models.TlTrack` or :class:`None`
export function core_tracklist_previous_track (tl_track) {

}

// Remove the matching tracks from the tracklist.
//
// Uses :meth:`filter()` to lookup the tracks to remove.
//
// Triggers the :meth:`mopidy.core.CoreListener.tracklist_changed` event.
//
// :param criteria: one or more rules to match by
// :type criteria: dict, of (string, list) pairs
// :rtype: list of :class:`mopidy.models.TlTrack` that were removed
export function core_tracklist_remove (criteria) {

}

// Set consume mode.
//
// :class:`True`
// Tracks are removed from the tracklist when they have been played.
// :class:`False`
// Tracks are not removed from the tracklist.
export function core_tracklist_set_consume (value) {

}

// Set random mode.
//
// :class:`True`
// Tracks are selected at random from the tracklist.
// :class:`False`
// Tracks are played in the order of the tracklist.
export function core_tracklist_set_random (value) {

}

// Set repeat mode.
//
// To repeat a single track, set both ``repeat`` and ``single``.
//
// :class:`True`
// The tracklist is played repeatedly.
// :class:`False`
// The tracklist is played once.
export function core_tracklist_set_repeat (value) {

}

// Set single mode.
//
// :class:`True`
// Playback is stopped after current song, unless in ``repeat`` mode.
// :class:`False`
// Playback continues after current song.
export function core_tracklist_set_single (value) {

}

// Shuffles the entire tracklist. If ``start`` and ``end`` is given only
// shuffles the slice ``[start:end]``.
//
// Triggers the :meth:`mopidy.core.CoreListener.tracklist_changed` event.
//
// :param start: position of first track to shuffle
// :type start: int or :class:`None`
// :param end: position after last track to shuffle
// :type end: int or :class:`None`
export function core_tracklist_shuffle (start?, end?) {

}

// Returns a slice of the tracklist, limited by the given start and end
// positions.
//
// :param start: position of first track to include in slice
// :type start: int
// :param end: position after last track to include in slice
// :type end: int
// :rtype: :class:`mopidy.models.TlTrack`
export function core_tracklist_slice (start, end) {

}
