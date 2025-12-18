import React, { useState, useEffect } from "react";
import ForumApi from "../../api/ForumApi";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector, useDispatch } from "react-redux";
import { openModal } from "../../context/redux/ModalReducer";

/**
 * Forum 컴포넌트
 * - 포럼 카테고리를 불러오며, Redux 스토어에서 사용자 정보를 가져옵니다.
 * - 사용자 정보가 없으면 로그인 모달을 띄워 로그인하도록 유도합니다.
 */
const Forum = () => {
  const dispatch = useDispatch();

  // Redux 스토어에서 사용자 정보를 가져옵니다. (UserReducer)
  const user = useSelector((state) => state.user);

  // 카테고리 목록 및 로딩 상태만 로컬로 관리
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // 만약 사용자가 로그인되어 있지 않으면 로그인 모달을 엽니다.
  useEffect(() => {
    if (!user || !user.id) {
      toast.warning("로그인이 필요합니다.");
      dispatch(openModal("login"));
    }
  }, [user, dispatch]);

  // 카테고리 목록 불러오기
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await ForumApi.fetchCategories();
        setCategories(data);
      } catch (error) {
        console.error("카테고리 목록 가져오기 실패:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading categories...</div>;
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 mt-24 text-kakiBrown dark:text-softBeige">
      <header className="mb-8">
        <h1 className="text-2xl md:text-4xl font-bold mb-2">포럼 카테고리</h1>
        <p className="text-base md:text-lg mb-4">
          자유롭게 소통하고 정보를 나눌 수 있는 게시판을 선택해보세요.
        </p>
        <Link
          to="/forum/create-post"
          className="inline-block px-4 py-2 bg-warmOrange dark:bg-deepOrange text-white rounded hover:bg-orange-600 dark:hover:bg-deepOrange/90 transition-colors"
        >
          새 글 작성
        </Link>
      </header>
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/forum/category/${category.id}`}
              state={{ categoryName: category.title }}
              className="block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow hover:shadow-lg transition-transform transform hover:-translate-y-1"
            >
              <h3 className="text-xl font-bold text-blue-600 mb-2">
                {category.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {category.description}
              </p>
              {/* <p className="text-sm text-right text-gray-500 dark:text-gray-400">
                {category.postCount > 0
                  ? `${category.postCount} 개의 게시글이 존재`
                  : "게시글이 아직 없습니다"}
              </p> */}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Forum;
