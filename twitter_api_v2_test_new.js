goal = [
    '1678207373771415552',
    'RT @Variety: Trixie Mattel at the L.A. premiere of #Barbie https://t.co/3vY12ZpcE8',
    '2489617394',
    'https://pbs.twimg.com/profile_images/1610677530016583687/j7Z-TiOG_normal.jpg',
    'https://twitter.com/gagathv',
    null,
    'gagathv',
    'amy',
    '2023-07-10 00:59:52',
    1688950792149,
    'en',
    '<a href="http://twitter.com/download/iphone" rel="nofollow">Twitter for iPhone</a>',
    2756,
    0,
    null,
    '1678198348216512515',
    0,
    '["video"]',
    'lk',
    'retweet',
    [
        '1676832485618118677',
        '1660933878025007107',
        '1615665140153864359',
        '1109100132186767512',
        '1658773329019556079',
        '1668760887426162690',
        '1615665140153856197'
    ],
    '1678198247876333569',
    4653,
    '17525171',
    '1678198348216512515'
]
const moment = require('moment')
const R = require('ramda')

const _eitherN = R.reduce(R.either, R.always(undefined))

const _boolToInt = (b) => b === true ? 1 : 0

const _getLocation = (data) => {
    const userLocation = R.path(['includes', 'users', '0', 'location'], data)
    if (userLocation === null || userLocation === undefined) {
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
    R.path(['includes', 'media']),
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

const getGeoId = R.path(['data', '0', 'geo', 'place_id'])

const getId = R.path(['data', '0', 'id'])

const getMessageLang = R.path(['data', '0', 'lang'])

const getUserId = R.path(['data', '0', 'author_id'])
const getImageUrl = R.path(['includes', 'users', '0', 'profile_image_url'])
const getFollowersCount = R.path(['includes', 'users', '0', 'public_metrics', 'followers_count'])

// const getTimestampMs = R.pipe(R.prop('timestamp_ms'), R.unless(R.isNil, parseInt))
const getTimestampMs = (data) => {
    const createdAt = R.path(['data', '0', 'created_at'], data)

    return new Date(createdAt).getTime() // less precise
}

const getUserVerified = R.pipe(R.path(['includes', 'users', '0', 'verified']), _boolToInt)

const getProfileUrl = (data) => `https://twitter.com/${getName(data)}`

const getRuleIds = R.pipe(
    R.prop('matching_rules'),
    R.defaultTo([]),
    R.map(R.prop('id'))
)

const getMessageText = R.pipe(
    R.path(['data', '0', 'text']),
    _normalize
)

const getName = (data) => {
    const name = R.path(['includes', 'users', '0', 'username'], data)
    return _normalize(name)
}
const getFullName = (data) => {
    const name = R.path(['includes', 'users', '0', 'name'], data)
    return _normalize(name)
}
const getCreatedAt = (data) => {
    const createdAt = R.path(['data', '0', 'created_at'], data)

    const dateInISOFormat = new Date(createdAt).toISOString() // toISOString converts to UTC (YYYY-MM-DDTHH:MM:SSZ)
    const yearMonthDatePart = dateInISOFormat.slice(0, 10)
    const hourMinuteSecondPart = dateInISOFormat.slice(11, 19)

    return yearMonthDatePart + ' ' + hourMinuteSecondPart
}

const getSentVia = (data) => {
    const source = R.path(['data', '0', 'source'], data)
    return _normalize(source, { removeSpecialChars: false })
}

const hasUrls = (data) => {
    const urls = R.path(['data', '0', 'entities', 'urls'], data)
    return R.isEmpty(urls) ? 0 : 1
}

const getParentId = R.or(
    R.path(['data', '0', 'referenced_tweets', '0', 'id']),
    null
)

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
        R.or(R.find(R.propEq('video', 'type')), null) // switch parameters in version 0.27!
    )
)

const getVideoId = R.pipe(
    _getVideo,
    R.prop('media_key')
)

const getVideoLength = R.pipe(
    _getVideo,
    R.prop('duration_ms')
)

const getVideoSourceUserId = R.always(null)

const getVideoSourceStatusId = R.always(null)

const getUserCountryCode = (data) => {
    const countryCode = R.path(['includes', 'places', '0', 'country_code'], data)

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

const isRetweet = R.pathEq('retweeted', ['data', '0', 'referenced_tweets', '0', 'type']);
const isReply = R.pathEq('replied_to', ['data', '0', 'referenced_tweets', '0', 'type']);
const isQuote = R.pathEq('quoted', ['data', '0', 'referenced_tweets', '0', 'type']);
const isTweet = (data) => {
    return (typeof getId(data) !== undefined) && (typeof getCreatedAt(data) !== undefined) && (typeof getMessageText(data) !== undefined)
}

const getType = R.cond([
    [isRetweet, R.always(EVENT_TYPES.RETWEET)],
    [isReply, R.always(EVENT_TYPES.REPLY)],
    [isQuote, R.always(EVENT_TYPES.QUOTE)],
    [isTweet, R.always(EVENT_TYPES.TWEET)],
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
    getTimestampMs, // Deprecated
    getMessageLang,
    getSentVia, // Why is it empty??? Not returned from API
    getFollowersCount,
    hasUrls,
    getGeoId, // Not present? Actual location may not be avail. only tagged location. to be discussed with Twitter
    getParentId, // There can be more than one referenced tweets! Here just fetching the first one
    getUserVerified,
    getMediaTypes,
    getUserCountryCode, //Actual location may not be avail. only tagged location. to be discussed with Twitter
    getType,
    getRuleIds,
    getVideoId, // Format has changed! eg. 1678198247876333569 -> 13_1678198247876333569
    getVideoLength,
    getVideoSourceUserId,// Deprecated ?
    getVideoSourceStatusId // Deprecated ?
])

const hasError = R.has('errors');

const build_v2_json = (tweet_json) => {
    if (hasError(tweet_json)) {
        return tweet_json;
    }

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
    build_v2_json
}
