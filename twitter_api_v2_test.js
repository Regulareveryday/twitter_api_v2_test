const moment = require('moment')
const R = require('ramda')

const _eitherN = R.reduce(R.either, R.always(undefined))

const _boolToInt = (b) => b === true ? 1 : 0

const _getLocation = (data) => {
    const userLocation = R.path(['user', 'location'], data)
    if (userLocation === null) {
        return null
    }
    const italy = {
        alpha2: 'it',
        locations: ['Milan', 'Italy', 'Italia', 'Roma', 'Napoli', 'Lazio', 'Lombardia', 'Sicili', 'Rome', 'Torino']
    }
    const countries = [italy]

    for (const countryIdx in countries) {
        const country = countries[countryIdx]
        const locations = country.locations

        const javaWordBoundary = '[^\\p{L}\\p{Mc}\\p{Me}\\p{N}\\p{Pc}]'
        const locationRegex = `(${locations.join('|')})`

        const pattern = new RegExp(`(^|${javaWordBoundary})${locationRegex}($|${javaWordBoundary})`, 'iu')
        const matched = userLocation.match(pattern)

        if (matched) {
            return country.alpha2
        }
    }
}

const _getMedia = _eitherN([
    R.path(['extended_tweet', 'extended_entities', 'media']),
    R.path(['extended_entities', 'media']),
    R.path(['extended_tweet', 'entities', 'media']),
    R.path(['entities', 'media']),
    R.always(null)
])

const _normalize = (string, { removeSpecialChars = true } = {}) => {
    // eslint-disable-next-line no-control-regex
    const javaWhiteSpace = '\\t\\n\\x0B\\f\\r '
    const multiSpacesPattern = new RegExp(`[${javaWhiteSpace}]+`, 'gm')
    const specialCharsPattern = new RegExp(`[\\u0000-\\u001f${javaWhiteSpace}]+`, 'gm')
    const trimBeforeRegexp = new RegExp(`^[${javaWhiteSpace}]*`, 'gm')
    const trimAfterRegexp = new RegExp(`[${javaWhiteSpace}]*$`, 'gm')
    const trim = R.pipe(
        R.replace(trimBeforeRegexp, ''),
        R.replace(trimAfterRegexp, '')
    )
    return R.unless(R.isNil,
        R.pipe(
            R.replace(multiSpacesPattern, ' '),
            R.when(() => removeSpecialChars, R.replace(specialCharsPattern, ' ')),
            trim
        )
    )(string)
}

const getTimeZone = R.always(null)
const getGeoId = R.always(null)

const getId = R.either(
    R.prop('id_str'),
    R.pipe(
        R.prop('id'),
        R.unless(R.is(String), () => { throw new Error('Expected the "id" field to be a string') })
    )
)

const getMessageLang = R.prop('lang')

const getUserId = R.path(['user', 'id_str'])
const getImageUrl = R.path(['user', 'profile_image_url_https'])
const getFollowersCount = R.path(['user', 'followers_count'])

const getTimestampMs = R.pipe(R.prop('timestamp_ms'), R.unless(R.isNil, parseInt))

const getUserVerified = R.pipe(R.path(['user', 'verified']), _boolToInt)

const getProfileUrl = (data) => `https://twitter.com/${getName(data)}`

const getRuleIds = R.pipe(
    R.prop('matching_rules'),
    R.defaultTo([]),
    R.map(R.prop('id_str'))
)

const getMessageText = R.pipe(
    R.either(
        R.path(['extended_tweet', 'full_text']),
        R.prop('text')
    ),
    _normalize
)

const getName = (data) => {
    const name = R.path(['user', 'screen_name'], data)
    return _normalize(name)
}
const getFullName = (data) => {
    const name = R.path(['user', 'name'], data)
    return _normalize(name)
}
const getCreatedAt = (data) => {
    const createdAt = R.prop('created_at', data)

    const dateInISOFormat = new Date(createdAt).toISOString() // toISOString converts to UTC (YYYY-MM-DDTHH:MM:SSZ)
    const yearMonthDatePart = dateInISOFormat.slice(0, 10)
    const hourMinuteSecondPart = dateInISOFormat.slice(11, 19)

    return yearMonthDatePart + ' ' + hourMinuteSecondPart
}

const getSentVia = (data) => {
    const source = R.prop('source', data)
    return _normalize(source, { removeSpecialChars: false })
}

const hasUrls = (data) => {
    const urls = R.path(['entities', 'urls'], data)
    return R.isEmpty(urls) ? 0 : 1
}

const getParentId = _eitherN([
    R.path(['retweeted_status', 'id_str']),
    R.path(['in_reply_to_status_id_str']),
    R.prop('quoted_status_id_str'),
    R.path(['favorited_status', 'id_str']),
    R.always(null)
])

const getMediaTypes =
    R.pipe(
        _getMedia,
        R.unless(R.isNil, R.pipe(
            R.map(R.prop('type')),
            JSON.stringify
        ))
    )

const _getVideo = R.pipe(
    _getMedia,
    R.unless(R.isNil,
        R.or(R.find(R.propEq('video', 'type')), null)
    )
)

const getVideoId = R.pipe(
    _getVideo,
    R.prop('id_str')
)

const getVideoLength = R.pipe(
    _getVideo,
    R.path(['video_info', 'duration_millis'])
)

const getVideoSourceUserId = R.pipe(
    _getVideo,
    R.prop('source_user_id_str')
)

const getVideoSourceStatusId = R.pipe(
    _getVideo,
    R.prop('source_status_id_str')
)

const getUserCountryCode = (data) => {
    const countryCode = R.path(['user', 'derived', 'locations', '0', 'country_code'], data)

    return (countryCode && countryCode.toLowerCase()) || _getLocation(data) || null
}

const getDth = (data) => {
    const dthFormat = 'YYYYMMDDHH'
    const timestampMs = getTimestampMs(data)

    if (!timestampMs) return null

    return moment(timestampMs).utc().format(dthFormat)
}

const EVENT_TYPES = {
    RETWEET: 'retweet',
    REPLY: 'reply',
    QUOTE: 'quote',
    LIKE: 'like',
    TWEET: 'tweet',
    ERROR: 'error',
    UNKNOWN: 'unknown'
}

const isRetweet = (data) => data.retweeted_status && data.retweeted_status.id != null
const isReply = (data) => data.in_reply_to_status_id != null
const isQuote = (data) => data.quoted_status_id != null
const isLike = (data) => data.favorited_status && data.favorited_status.id != null
const isTweet = (data) => data.id && data.created_at && data.text
const isError = (data) => data.error != null

const getType = R.cond([
    [isRetweet, R.always(EVENT_TYPES.RETWEET)],
    [isReply, R.always(EVENT_TYPES.REPLY)],
    [isQuote, R.always(EVENT_TYPES.QUOTE)],
    [isLike, R.always(EVENT_TYPES.LIKE)],
    [isTweet, R.always(EVENT_TYPES.TWEET)],
    [isError, R.always(EVENT_TYPES.ERROR)],
    [R.T, R.always(EVENT_TYPES.UNKNOWN)]
])


const build = R.juxt([
    getId,
    getMessageText,
    getUserId,
    getImageUrl,
    getProfileUrl,
    getTimeZone,
    getName,
    getFullName,
    getCreatedAt,
    getTimestampMs,
    getMessageLang,
    getSentVia,
    getFollowersCount,
    hasUrls,
    getGeoId,
    getParentId,
    getUserVerified,
    getMediaTypes,
    getUserCountryCode,
    getType,
    getRuleIds,
    getVideoId,
    getVideoLength,
    getVideoSourceUserId,
    getVideoSourceStatusId
])

const build_gnip2_json = (tweet_json) => {
    parsed = build(tweet_json)

    return {
        "id": parsed[0],
        "message_text": parsed[1],
        "user_id": parsed[2],
        "image_url": parsed[3],
        "profile_url": parsed[4],
        "time_zone": parsed[5],
        "name": parsed[6],
        "full_name": parsed[7],
        "create_date": parsed[8],
        "timestampms": parsed[9],
        "message_lang": parsed[10],
        "sent_via": parsed[11],
        "followers_count": parsed[12],
        "has_urls": parsed[13],
        "geo_id": parsed[14],
        "parent_id": parsed[15],
        "user_verified": parsed[16],
        "media_types": parsed[17],
        "user_country_code": parsed[18],
        "typee": parsed[19],
        "rule_ids": parsed[20],
        "video_id": parsed[21],
        "video_length": parsed[22],
        "video_source_user_id": parsed[23],
        "video_source_status_id": parsed[24]
    }
}

module.exports = {
    build_gnip2_json
}