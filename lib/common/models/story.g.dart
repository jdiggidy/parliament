// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'story.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Story _$StoryFromJson(Map<String, dynamic> json) => Story(
      sid: json['sid'] as String,
      createdAt: Utils.timestampFromJson((json['createdAt'] as num).toInt()),
      updatedAt: Utils.timestampFromJson((json['updatedAt'] as num).toInt()),
      happenedAt: Utils.timestampFromJsonNullable(
          (json['happenedAt'] as num?)?.toInt()),
      newsworthyAt: Utils.timestampFromJsonNullable(
          (json['newsworthyAt'] as num?)?.toInt()),
      location: json['location'] == null
          ? null
          : Location.fromJson(json['location'] as Map<String, dynamic>),
      title: json['title'] as String?,
      description: json['description'] as String?,
      headline: json['headline'] as String?,
      subHeadline: json['subHeadline'] as String?,
      lede: json['lede'] as String?,
      article: json['article'] as String?,
      avgReplies: (json['avgReplies'] as num?)?.toDouble(),
      avgReposts: (json['avgReposts'] as num?)?.toDouble(),
      avgLikes: (json['avgLikes'] as num?)?.toDouble(),
      avgBookmarks: (json['avgBookmarks'] as num?)?.toDouble(),
      avgViews: (json['avgViews'] as num?)?.toDouble(),
      avgSocialScore: (json['avgSocialScore'] as num?)?.toDouble(),
      avgEntityVirality: json['avgEntityVirality'] == null
          ? null
          : Confidence.fromJson(json['avgEntityVirality']),
      avgPlatformVirality: json['avgPlatformVirality'] == null
          ? null
          : Confidence.fromJson(json['avgPlatformVirality']),
      newsworthiness: json['newsworthiness'] == null
          ? null
          : Confidence.fromJson(json['newsworthiness']),
      virality: json['virality'] == null
          ? null
          : Confidence.fromJson(json['virality']),
      bias: json['bias'] == null
          ? null
          : PoliticalPosition.fromJson(json['bias']),
      confidence: json['confidence'] == null
          ? null
          : Confidence.fromJson(json['confidence']),
      status: $enumDecode(_$StoryStatusEnumMap, json['status']),
      pids:
          (json['pids'] as List<dynamic>?)?.map((e) => e as String).toList() ??
              const [],
      stids:
          (json['stids'] as List<dynamic>?)?.map((e) => e as String).toList() ??
              const [],
      plids:
          (json['plids'] as List<dynamic>?)?.map((e) => e as String).toList() ??
              const [],
      photos: (json['photos'] as List<dynamic>?)
              ?.map((e) => Photo.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$StoryToJson(Story instance) => <String, dynamic>{
      'sid': instance.sid,
      'pids': instance.pids,
      'stids': instance.stids,
      'plids': instance.plids,
      'title': instance.title,
      'description': instance.description,
      'headline': instance.headline,
      'subHeadline': instance.subHeadline,
      'lede': instance.lede,
      'article': instance.article,
      'photos': instance.photos.map((e) => e.toJson()).toList(),
      'location': instance.location?.toJson(),
      'avgReplies': instance.avgReplies,
      'avgReposts': instance.avgReposts,
      'avgLikes': instance.avgLikes,
      'avgBookmarks': instance.avgBookmarks,
      'avgViews': instance.avgViews,
      'avgSocialScore': instance.avgSocialScore,
      'avgEntityVirality': instance.avgEntityVirality?.toJson(),
      'avgPlatformVirality': instance.avgPlatformVirality?.toJson(),
      'status': _$StoryStatusEnumMap[instance.status]!,
      'bias': instance.bias?.toJson(),
      'confidence': instance.confidence?.toJson(),
      'newsworthiness': instance.newsworthiness?.toJson(),
      'virality': instance.virality?.toJson(),
      'createdAt': Utils.timestampToJson(instance.createdAt),
      'updatedAt': Utils.timestampToJson(instance.updatedAt),
      'happenedAt': Utils.timestampToJsonNullable(instance.happenedAt),
      'newsworthyAt': Utils.timestampToJsonNullable(instance.newsworthyAt),
    };

const _$StoryStatusEnumMap = {
  StoryStatus.draft: 'draft',
  StoryStatus.findingContext: 'findingContext',
  StoryStatus.foundContext: 'foundContext',
  StoryStatus.found: 'found',
};
