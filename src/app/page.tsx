import Link from "next/link";

const HomePage = () => {
  return (
    <div>
      <Link href="/example1" className="text-blue-500 underline">
        Example 1 - Basic React Integration
      </Link>
      <br />
      <Link href="/example2" className="text-blue-500 underline">
        Example 2 - Server API
      </Link>
    </div>
  );
};

export default HomePage;
