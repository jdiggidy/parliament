import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:political_think/common/components/zbottom_bar_scaffold.dart';
import 'package:political_think/common/components/zerror.dart';
import 'package:political_think/common/models/political_position.dart';
import 'package:political_think/common/services/zprovider.dart';
import 'package:political_think/sharing.dart';
import 'package:political_think/views/feed/feed.dart';
import 'package:political_think/views/games/games.dart';
import 'package:political_think/views/login/login.dart';
import 'package:political_think/views/message/message.dart';
import 'package:political_think/views/post/post_view.dart';
import 'package:political_think/views/profile/profile.dart';
import 'package:political_think/views/maps/maps.dart';

class ZRouter {
  static final rootNavigatorKey = GlobalKey<NavigatorState>();
  static final _shellNavigatorKey = GlobalKey<NavigatorState>();

  static GoRouter instance(
    WidgetRef ref,
  ) {
    return GoRouter(
      initialLocation: Login.location,
      navigatorKey: rootNavigatorKey,
      routes: [
        ShellRoute(
          navigatorKey: _shellNavigatorKey,
          pageBuilder: (context, state, child) {
            return NoTransitionPage(
              child: ZBottomBarScaffold(
                location: state.fullPath ?? '',
                child: child,
              ),
            );
          },
          routes: [
            GoRoute(
              parentNavigatorKey: _shellNavigatorKey,
              path: Feed.location,
              pageBuilder: (context, state) => const NoTransitionPage(
                child: Feed(),
              ),
            ),
            GoRoute(
              parentNavigatorKey: _shellNavigatorKey,
              path: Maps.location,
              pageBuilder: (context, state) => const NoTransitionPage(
                child: Maps(),
              ),
            ),
            GoRoute(
              parentNavigatorKey: _shellNavigatorKey,
              path: Games.location,
              pageBuilder: (context, state) => const NoTransitionPage(
                child: Games(),
              ),
            ),
            GoRoute(
              parentNavigatorKey: _shellNavigatorKey,
              path: Messages.location,
              pageBuilder: (context, state) => const NoTransitionPage(
                child: Messages(),
              ),
            ),
            GoRoute(
              parentNavigatorKey: _shellNavigatorKey,
              path: Profile.location,
              pageBuilder: (context, state) => const NoTransitionPage(
                child: Profile(),
              ),
            ),
            GoRoute(
              parentNavigatorKey: _shellNavigatorKey,
              path: "${PostView.location}/:pid",
              pageBuilder: (context, state) => NoTransitionPage(
                child: PostView(
                  pid: state.pathParameters["pid"]!,
                ),
              ),
            ),
          ],
        ),
        GoRoute(
          parentNavigatorKey: rootNavigatorKey,
          path: Login.location,
          pageBuilder: (context, state) => const NoTransitionPage(
            child: Login(),
          ),
        ),
        // GoRoute(
        //   parentNavigatorKey: rootNavigatorKey,
        //   path: "${PostView.location}/:pid",
        //   pageBuilder: (context, state) => NoTransitionPage(
        //     child: PostView(
        //       pid: state.pathParameters["pid"]!,
        //     ),
        //   ),
        // ),
      ],
      refreshListenable: ref.watch(authProvider),
      redirect: (context, state) {
        final authState = ref.read(authProvider);
        final loggedIn = authState.isLoggedIn;
        final loginPath = state.fullPath?.startsWith(Login.location) ?? false;
        // final loading = authState.isLoading;
        if (state.uri.path == '/') {
          return Login.location;
        }

        if (!loggedIn) {
          return Login.location;
        }

        if (loggedIn && loginPath) {
          return Feed.location;
        }

        return null;
      },
    );
  }
}
