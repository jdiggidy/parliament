import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:political_think/common/components/loading.dart';
import 'package:political_think/common/components/location_map.dart';
import 'package:political_think/common/components/political_position_component.dart';
import 'package:political_think/common/components/zdivider.dart';
import 'package:political_think/common/extensions.dart';
import 'package:political_think/common/models/political_position.dart';
import 'package:political_think/common/util/zimage.dart';
import 'package:political_think/views/bias/political_position_widget.dart';
import 'package:political_think/views/confidence/confidence_widget.dart';
import 'package:political_think/views/post/post_item_view.dart';
import 'package:political_think/views/story/story_view.dart';

class StoryItemView extends ConsumerStatefulWidget {
  const StoryItemView({
    super.key,
    required this.sid,
  });

  final String sid;

  @override
  ConsumerState<ConsumerStatefulWidget> createState() => _StoryItemViewState();
}

class _StoryItemViewState extends ConsumerState<StoryItemView> {
  _onTapStory() {
    context.route("${StoryView.location}/${widget.sid}");
  }

  @override
  Widget build(BuildContext context) {
    var storyRef = ref.storyWatch(widget.sid);
    var story = storyRef.value;
    //
    // var primaryPostsRef = ref.primaryPostsFromStoriesWatch(widget.sid);
    // var primaryPosts = primaryPostsRef.value;

    var allPostsRef = ref.postsFromStoryWatch(widget.sid);
    var allPosts = allPostsRef.value;

    bool shouldShowSecondaryPosts = (allPosts?.length ?? 0) >= 1;
    bool shouldShowPhotos = (story?.photos.length ?? 0) >= 1;
    double newsworthiness = story?.newsworthiness?.value ?? 0.0;

    return storyRef.isLoading || allPostsRef.isLoading
        ? const Loading(type: LoadingType.post)
        : story == null || !allPostsRef.hasValue || (allPosts?.isEmpty ?? true)
            ? const SizedBox.shrink()
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      story.headline != null || story.title != null
                          ? Expanded(
                              flex: 5,
                              child: MouseRegion(
                                cursor: SystemMouseCursors.click,
                                child: GestureDetector(
                                  onTap: _onTapStory,
                                  child: Text(
                                    story.headline ?? story.title!,
                                    style: newsworthiness < 0.5
                                        ? context.h5b
                                        : newsworthiness < 0.7
                                            ? context.h4b
                                            : newsworthiness < 0.9
                                                ? context.h3b
                                                : context.h2b,
                                    textAlign: TextAlign.start,
                                  ),
                                ),
                              ),
                            )
                          : const SizedBox.shrink(),
                      const Spacer(),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          if (story.confidence != null) ...[
                            ConfidenceWidget(
                              confidence: story.newsworthiness!,
                              enabled: false,
                            ),
                            context.sh,
                          ],
                          if (true) ...[
                            PoliticalPositionWidget(
                              position: const PoliticalPosition(angle: 90),
                              enabled: false,
                              radius: context.iconSizeStandard / 2,
                            ),
                            context.sh,
                          ],
                          if (story.newsworthiness != null) ...[
                            ConfidenceWidget(
                              confidence: story.newsworthiness!,
                              enabled: false,
                              wave: true,
                            ),
                            context.sh,
                          ],
                          if (story.location != null) ...[
                            LocationMap(location: story.location!),
                            // Avoid adding a spacer after the last widget
                          ],
                        ],
                      )
                    ],
                  ),
                  context.sh,
                  story.subHeadline != null
                      ? MouseRegion(
                          cursor: SystemMouseCursors.click,
                          child: GestureDetector(
                            onTap: _onTapStory,
                            child: Text(
                              story.subHeadline!,
                              style: context.m,
                              textAlign: TextAlign.start,
                            ),
                          ),
                        )
                      : const SizedBox.shrink(),
                  Visibility(visible: shouldShowPhotos, child: context.sh),
                  Visibility(
                    visible: shouldShowPhotos,
                    child: SizedBox(
                      height: context.blockSize.height,
                      width: context.blockSize.width,
                      child: ListView.separated(
                        shrinkWrap: true,
                        scrollDirection: Axis.horizontal,
                        itemCount: story.photos.length,
                        itemBuilder: (context, index) {
                          var photo = story.photos[index];
                          return ZImage(photoURL: photo.photoURL);
                        },
                        separatorBuilder: (context, index) =>
                            const ZDivider(type: DividerType.VERTICAL),
                      ),
                    ),
                  ),
                  Visibility(
                      visible: shouldShowSecondaryPosts, child: context.sh),
                  Visibility(
                      visible: shouldShowSecondaryPosts,
                      child: const ZDivider(type: DividerType.SECONDARY)),
                  Visibility(
                    visible: shouldShowSecondaryPosts,
                    child: SizedBox(
                      height: context.blockSizeXS.height,
                      child: ListView.separated(
                        shrinkWrap: true,
                        scrollDirection: Axis.horizontal,
                        itemCount: allPosts!.length,
                        itemBuilder: (context, index) {
                          var post = allPosts[index];
                          return PostItemView(
                            pid: post.pid,
                            story: story,
                            isSubView: true,
                          );
                        },
                        separatorBuilder: (context, index) =>
                            const ZDivider(type: DividerType.VERTICAL),
                      ),
                    ),
                  ),
                ],
              );
  }
}
